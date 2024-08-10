import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy as JWTStrategy } from 'passport-jwt';
import { Request } from 'express';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JWT_REFRESH_STRATEGY } from '~/constants/auth.const';
import { JWT } from '~/constants/global.const';
import { ITokenPayload } from '@modules/shared/auth';

@Injectable()
export class RefreshStrategy extends PassportStrategy(JWTStrategy, JWT_REFRESH_STRATEGY) {
  constructor(private readonly configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        (req: Request) => req?.cookies?.refreshToken || null,
      ]),
      secretOrKey: configService.get(JWT.REFRESH_SECRET, ''),
      passReqToCallback: true,
    });
  }

  async validate(req: Request, payload: ITokenPayload) {
    console.log('RefreshStrategy: validate', payload, req.cookies);
    return payload;
  }
}
