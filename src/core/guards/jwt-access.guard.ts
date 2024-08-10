import { ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { JWT } from '~constants/global.const';
import { JWT_ACCESS_STRATEGY, REFRESH_TOKEN } from '~constants/auth.const';
import { Request, Response } from 'express';
import { AuthService } from '@modules/shared/auth';

@Injectable()
export class JwtAccessAuthGuard extends AuthGuard(JWT_ACCESS_STRATEGY) {
  constructor(
    private readonly jwtService: JwtService,
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {
    super();
  }

  handleRequest(err, user, info, context: ExecutionContext, status) {
    console.log('JwtAccessAuthGuard', { err, user, info, context, status });

    if (err || !user) {
      const handler = context.getHandler();
      if (handler.name === 'logout') {
        const req = context.switchToHttp().getRequest<Request>();
        const refreshToken = req.cookies.refreshToken;
        if (!refreshToken) {
          console.log('JwtAccessAuthGuard', 'NO_REFRESH_TOKEN');
          throw err || new UnauthorizedException();
        }

        const user = this.jwtService.decode(refreshToken);
        const res = context.switchToHttp().getResponse<Response>();
        if (!user) {
          console.log('JwtAccessAuthGuard', 'NO_USER_IN_REFRESH_TOKEN');
          res.clearCookie(REFRESH_TOKEN);
          throw new ForbiddenException();
        }

        return this.authService
          .verifyToken(user.id, refreshToken, this.configService.get(JWT.REFRESH_SECRET, ''))
          .then((isTokenValid) => {
            console.log({ isTokenValid, user });
            if (!isTokenValid) {
              console.log('EXPIRED_REFRESH_TOKEN', isTokenValid);
              res.clearCookie(REFRESH_TOKEN);
              throw new ForbiddenException();
            }

            console.log('VALID_REFRESH_TOKEN');
            return user;
          });
      }

      throw err || new UnauthorizedException();
    }

    console.log('VALID_ACCESS_TOKEN');
    return user;
  }
}
