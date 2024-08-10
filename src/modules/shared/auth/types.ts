import { JwtSignOptions } from '@nestjs/jwt';
import { SignUpDto } from './dto';
import { ACCESS_TOKEN, REFRESH_TOKEN } from '~/constants/auth.const';

export interface ITokens {
  [ACCESS_TOKEN]: string;
  [REFRESH_TOKEN]: string;
}

export interface ITokenPayload extends Omit<SignUpDto, 'password'> {
  id: number;
  email: string;
  // iat: number;
  // exp: number;
}

export interface IAuthResponse extends ITokens {
  user: ITokenPayload;
}

export type TTokenOptions = Record<keyof ITokens, JwtSignOptions>;
