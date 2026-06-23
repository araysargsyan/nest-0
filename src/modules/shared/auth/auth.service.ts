import { NotFoundException, HttpException, Injectable, UnauthorizedException } from '@nestjs/common';
import { SignInDto, SignUpDto } from './dto';
import { compare, hash } from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { IAuthResponse, ITokenPayload, ITokens, TTokenOptions } from './types';
import { ConfigService } from '@nestjs/config';
import { ACCESS_TOKEN, REFRESH_TOKEN } from '~/constants/auth.const';
import { JWT } from '~/constants/global.const';
import { UserService } from '@modules/user/user.service';
import { PrismaService } from '@modules/shared/prisma/prisma.service';
import { RedisLockService } from '@modules/shared/redis/redis-lock.service';
import * as crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';

const LOCK_TTL_SECONDS = 5;
const GRACE_PERIOD_SECONDS = 15;
const WAIT_TIMEOUT_MS = 4000;

@Injectable()
export class AuthService {
  private tokensOptions: TTokenOptions = {
    [ACCESS_TOKEN]: {},
    [REFRESH_TOKEN]: {},
  };

  static getJWTExpiresInMilliseconds(time: string = ''): number {
    const map = {
      s: 1000,
      m: 1000 * 60,
      h: 1000 * 60 * 60,
      d: 1000 * 60 * 60 * 24,
    };
    const index = time.replace(/[|&;$%@"<>()+,0-9]/g, '');
    return map[index] ? +time.split(index)[0] * map[index] : null;
  }

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly userService: UserService,
    private readonly prismaService: PrismaService,
    private readonly redisLock: RedisLockService,
  ) {
    this.initializeTokensOptions();
  }

  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  private async createInitialSession(payload: ITokenPayload): Promise<ITokens> {
    const tokens = await this.generateTokens(payload);
    const tokenHash = this.hashToken(tokens.refreshToken);
    const familyId = uuidv4();
    
    const refreshExpiresIn = this.configService.get(JWT.REFRESH_EXPIRES_IN, '30d');
    const expiresAt = new Date(Date.now() + AuthService.getJWTExpiresInMilliseconds(refreshExpiresIn));

    await this.prismaService.refreshToken.create({
      data: {
        userId: payload.id,
        tokenHash,
        familyId,
        expiresAt,
      },
    });

    return tokens;
  }

  async signUp({ password, ...data }: SignUpDto): Promise<IAuthResponse> {
    try {
      const newUser = await this.userService.create({
          ...data,
          hash: await this.hashData(password)
      });

      const tokens = await this.createInitialSession({
        id: newUser.id,
        email: newUser.email,
        name: newUser.name,
        surname: newUser.surname,
      });

      return {
        ...tokens,
        user: {
          id: newUser.id,
          email: newUser.email,
          name: newUser.name,
          surname: newUser.surname,
        },
      };
    } catch (e) {
      console.log(e);
      throw e;
    }
  }

  async signIn({ email, password }: SignInDto): Promise<IAuthResponse> {
    try {
      const user = await this.userService.findByEmail(email);

      if (!user) throw new NotFoundException('User not found');

      if (!(await compare(password, user.hash))) {
        throw new NotFoundException('User not found::');
      }

      const tokens = await this.createInitialSession({
        id: user.id,
        email: user.email,
        name: user.name,
        surname: user.surname,
      });

      return {
        ...tokens,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          surname: user.surname,
        },
      };
    } catch (e) {
      console.log(e, 666);
      if (e instanceof HttpException) {
        throw e;
      }
      throw e;
    }
  }

  async refresh(oldRefreshToken: string, payload: ITokenPayload): Promise<ITokens> {
    const tokenHash = this.hashToken(oldRefreshToken);
    const lockKey = `refresh:lock:${tokenHash}`;
    const channelKey = `refresh:channel:${tokenHash}`;

    const acquired = await this.redisLock.acquireLock(lockKey, LOCK_TTL_SECONDS);

    if (!acquired) {
      try {
        const result = await this.redisLock.waitForResult(channelKey, WAIT_TIMEOUT_MS);
        return JSON.parse(result);
      } catch {
        throw new UnauthorizedException('Refresh timeout, please retry');
      }
    }

    try {
      const cached = await this.redisLock.getGraceResult(channelKey);
      if (cached) return JSON.parse(cached);

      const tokenRecord = await this.prismaService.refreshToken.findUnique({
        where: { tokenHash },
      });

      if (!tokenRecord) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      if (tokenRecord.expiresAt < new Date()) {
        throw new UnauthorizedException('Refresh token expired');
      }

      if (tokenRecord.revoked || tokenRecord.usedAt !== null) {
        await this.prismaService.refreshToken.updateMany({
          where: { familyId: tokenRecord.familyId },
          data: { revoked: true },
        });
        throw new UnauthorizedException('Token reuse detected, session revoked');
      }

      const newTokens = await this.generateTokens(payload);
      const newHash = this.hashToken(newTokens.refreshToken);
      
      const refreshExpiresIn = this.configService.get(JWT.REFRESH_EXPIRES_IN, '30d');
      const expiresAt = new Date(Date.now() + AuthService.getJWTExpiresInMilliseconds(refreshExpiresIn));

      await this.prismaService.$transaction([
        this.prismaService.refreshToken.update({
          where: { id: tokenRecord.id },
          data: { usedAt: new Date(), revoked: true },
        }),
        this.prismaService.refreshToken.create({
          data: {
            userId: payload.id,
            tokenHash: newHash,
            familyId: tokenRecord.familyId,
            expiresAt,
          },
        }),
      ]);

      const responsePayload = JSON.stringify(newTokens);
      await this.redisLock.publishResult(channelKey, responsePayload, GRACE_PERIOD_SECONDS);

      return newTokens;
    } finally {
      await this.redisLock.releaseLock(lockKey);
    }
  }

  async logout(user: ITokenPayload, refreshToken: string): Promise<boolean> {
    try {
      if (!refreshToken) return false;
      const tokenHash = this.hashToken(refreshToken);
      const tokenRecord = await this.prismaService.refreshToken.findUnique({
        where: { tokenHash },
      });

      if (tokenRecord) {
        await this.prismaService.refreshToken.updateMany({
          where: { familyId: tokenRecord.familyId },
          data: { revoked: true },
        });
        return true;
      }
      return false;
    } catch (e) {
      console.log(e, 'LOGOUT');
      return false;
    }
  }

  check(userId: number) {
    return this.userService.findMany({ NOT: { id: userId } });
  }

  async verifyToken(userId: number, token: string, secret: string): Promise<boolean> {
    const isRtValid = await this.jwtService.verifyAsync(token, { secret }).catch(() => false);

    const tokenHash = this.hashToken(token);

    if (!isRtValid) {
      const tokenRecord = await this.prismaService.refreshToken.findUnique({
        where: { tokenHash },
      });
      if (tokenRecord) {
        await this.prismaService.refreshToken.updateMany({
          where: { familyId: tokenRecord.familyId },
          data: { revoked: true },
        });
      }
      return false;
    }

    const tokenRecord = await this.prismaService.refreshToken.findUnique({
      where: { tokenHash },
    });

    if (!tokenRecord || tokenRecord.revoked || tokenRecord.expiresAt < new Date()) {
      return false;
    }

    return true;
  }

  private hashData(data: string): Promise<string> {
    return hash(data, 10);
  }

  private async generateTokens(payload: ITokenPayload): Promise<ITokens> {
    const accessToken = await this.createToken(payload, ACCESS_TOKEN);
    const refreshToken = await this.createToken(payload, REFRESH_TOKEN);

    return { accessToken, refreshToken };
  }

  private async createToken(payload: ITokenPayload, type): Promise<string> {
    const a: any = { ...payload };
    delete a.exp;
    delete a.iat;
    a.jti = uuidv4(); // unique JWT ID — prevents identical tokens when signed in the same second
    return await this.jwtService.signAsync(a, this.tokensOptions[type]);
  }

  private initializeTokensOptions() {
    this.tokensOptions.accessToken.secret = this.configService.get(JWT.ACCESS_SECRET, '');
    this.tokensOptions.accessToken.expiresIn = this.configService.get(JWT.ACCESS_EXPIRES_IN, '');
    this.tokensOptions.refreshToken.secret = this.configService.get(JWT.REFRESH_SECRET, '');
    this.tokensOptions.refreshToken.expiresIn = this.configService.get(JWT.REFRESH_EXPIRES_IN, '');
  }
}
