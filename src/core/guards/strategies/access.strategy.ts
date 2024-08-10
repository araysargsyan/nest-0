import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy as JWTStrategy } from 'passport-jwt';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import {JWT_ACCESS_STRATEGY } from '~/constants/auth.const';
import { JWT } from '~/constants/global.const';
import { ITokenPayload } from '@modules/shared/auth';

@Injectable()
export class AccessStrategy extends PassportStrategy(JWTStrategy, JWT_ACCESS_STRATEGY) {
  constructor(private readonly configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: configService.get(JWT.ACCESS_SECRET, ''),
      passReqToCallback: true,
    });
  }

  validate(req: Request, payload: ITokenPayload) {
    console.log('AccessStrategy: validate', { payload });
    return payload
  }
}

