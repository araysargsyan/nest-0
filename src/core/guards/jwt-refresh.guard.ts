import { Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { JWT_REFRESH_STRATEGY } from '~constants/auth.const';

@Injectable()
export class JwtRefreshAuthGuard extends AuthGuard(JWT_REFRESH_STRATEGY) {
  handleRequest(err, user, info, context, status) {
    console.log('JwtRefreshAuthGuard', { err, user, info, context, status });
    if (err || !user) {
      throw err || new UnauthorizedException();
    }

    return user;
  }
}
