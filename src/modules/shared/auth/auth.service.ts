import { NotFoundException, HttpException, Injectable } from '@nestjs/common';
import { SignInDto, SignUpDto } from './dto';
import { compare, hash } from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { IAuthResponse, ITokenPayload, ITokens, TTokenOptions } from './types';
import { ConfigService } from '@nestjs/config';
import { ACCESS_TOKEN, REFRESH_TOKEN } from '~/constants/auth.const';
import { JWT } from '~/constants/global.const';
import { UserService } from '@modules/user/user.service';

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
    private readonly userService: UserService
  ) {
    this.initializeTokensOptions();
  }

  async signUp({ password, ...data }: SignUpDto): Promise<IAuthResponse> {
    try {
      const newUser = await this.userService.create({
          ...data,
          hash: await this.hashData(password)
      });

      return {
        ...(await this.getTokens(newUser)),
        user: {
          id: newUser.id,
          email: newUser.email,
          name: newUser.name,
          surname: newUser.surname,
        },
      };
    } catch (e) {
      console.log(e);
    }
  }

  async signIn({ email, password }: SignInDto): Promise<IAuthResponse> {
    try {
      const user = await this.userService.findByEmail(email);

      if (!user) throw new NotFoundException('User not found');

      if (!(await compare(password, user.hash))) {
        throw new NotFoundException('User not found::');
      }

      return {
        ...(await this.getTokens(user)),
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
    }
  }

  async refresh(user: ITokenPayload): Promise<ITokens> {
    return await this.getTokens(user);
  }

  async logout(user: ITokenPayload) {
    try {
      return await this.userService.clearRtById(user.id);
    } catch (e) {
      console.log(e, 'LOGOUT');
    }
  }

  check(userId: number) {
    return this.userService.findMany({ NOT: { id: userId } });
  }

  async verifyToken(userId: number, token: string, secret: string): Promise<boolean> {
    const isRtValid = await this.jwtService.verifyAsync(token, { secret }).catch(() => false);

    if (!isRtValid) {
      await this.userService.clearRtById(userId);

      return false;
    }

    const hashedRt = (await this.userService.findUnique(
      userId, { hashedRt: true })
    ).hashedRt || '';

    return await compare(token, hashedRt);
  }

  private hashData(data: string): Promise<string> {
    return hash(data, 10);
  }

  private async getTokens({ id, ...data }: ITokenPayload): Promise<ITokens> {
    const tokens = await this.generateTokens({ id, ...data });
    await this.updateUserHashedRt(id, tokens.refreshToken);

    return tokens;
  }

  private async generateTokens(payload: ITokenPayload): Promise<ITokens> {
    const accessToken = await this.createToken(payload, ACCESS_TOKEN);
    const refreshToken = await this.createToken(payload, REFRESH_TOKEN);

    return { accessToken, refreshToken };
  }

  private async createToken(payload: ITokenPayload, type): Promise<string> {
    const a: any = payload;
    delete a.exp;
    delete a.iat;
    return await this.jwtService.signAsync(a, this.tokensOptions[type]);
  }

  private async updateUserHashedRt(userId: number, refreshToken: string) {
    const hashedRt = await this.hashData(refreshToken);
    await this.userService.updateRtById(userId, hashedRt);
  }

  private initializeTokensOptions() {
    this.tokensOptions.accessToken.secret = this.configService.get(JWT.ACCESS_SECRET, '');
    this.tokensOptions.accessToken.expiresIn = this.configService.get(JWT.ACCESS_EXPIRES_IN, '');
    this.tokensOptions.refreshToken.secret = this.configService.get(JWT.REFRESH_SECRET, '');
    this.tokensOptions.refreshToken.expiresIn = this.configService.get(JWT.REFRESH_EXPIRES_IN, '');
  }
}
