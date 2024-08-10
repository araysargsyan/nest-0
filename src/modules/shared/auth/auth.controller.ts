// async function Space(giveMe: string) {
//   const life = () =>
//     (async (whatCanIdo: any, why?: unknown) => {
//       return Promise.resolve(() => {
//         if (whatCanIdo === 'LOVE') {
//           console.log(`I ${whatCanIdo} U`);
//           return 'U WIN';
//         } else {
//           throw new Error('Do it yourself!!!');
//         }
//       })
//         .then((loop) => loop())
//         .catch((error) => {
//           console.error(error.message);
//           return 'R.I.P';
//         })
//         .finally(() => {
//           if (why === undefined) {
//             console.info(Infinity);
//           } else {
//             console.info(null);
//           }
//         });
//     })(giveMe);
//   return await life();
// }
// Space('LOVE')
//   .then(() => 'Get a peace')
//   .catch(() => 'Get a pain');

import { Body, Controller, Get, HttpCode, HttpStatus, Post, Req, Res, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { SignInDto, SignUpDto } from './dto';
import { IAuthResponse, ITokens } from './types';
import { Request, Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { JwtAccessAuthGuard } from '@core/guards/jwt-access.guard';
import { JwtRefreshAuthGuard } from '@core/guards/jwt-refresh.guard';
import { REFRESH_TOKEN } from '~/constants/auth.const';
import { JWT } from '~/constants/global.const';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService, private configService: ConfigService) {}

  @Post('sign-up')
  @HttpCode(HttpStatus.CREATED)
  signUp(@Body() dto: SignUpDto, @Res({ passthrough: true }) res: Response): Promise<ITokens> {
    return this.authService
      .signUp(dto)
      .then(
        ({ accessToken, refreshToken, user }) =>
          this.setCookie({ refreshToken }, res) && { accessToken, refreshToken, user },
      );
  }

  @Post('sign-in')
  @HttpCode(HttpStatus.OK)
  signIn(@Body() dto: SignInDto, @Res({ passthrough: true }) res: Response): Promise<IAuthResponse> {
    return this.authService.signIn(dto).then(
      ({ accessToken, refreshToken, user }) =>
        this.setCookie({ refreshToken }, res) && {
          accessToken,
          refreshToken,
          user,
        },
    );
  }

  @Get('sign-out')
  @UseGuards(JwtAccessAuthGuard)
  @HttpCode(HttpStatus.OK)
  logout(@Req() { user, res }: Request) {
    console.log('CONTROLLER->logout');
    return this.authService.logout(user).then((cleared) => {
      res.clearCookie(REFRESH_TOKEN);
      if (!cleared) res.status(HttpStatus.NOT_MODIFIED); //! if refreshToken have been deleted from db;
    });
  }

  @Get('refresh')
  @UseGuards(JwtRefreshAuthGuard)
  @HttpCode(HttpStatus.OK)
  refresh(@Req() { user, res }: Request): Promise<IAuthResponse> {
    console.log('Controller: refresh', user);
    return this.authService.refresh(user).then((tokens) => {
        this.setCookie(tokens, res)

        return {
          ...tokens,
          user,
        }
      },
    );
  }

  @Get('check')
  @UseGuards(JwtAccessAuthGuard)
  @HttpCode(HttpStatus.OK)
  async check(@Req() { user }: Request): Promise<any> {
    const users = await this.authService.check(user?.id);
    return users;
  }

  @Get('me')
  @UseGuards(JwtAccessAuthGuard)
  @HttpCode(HttpStatus.OK)
  async me(@Req() { user }: Request): Promise<any> {
    return user;
  }

  private setCookie({ refreshToken }: Partial<ITokens>, res: Response) {
    res.cookie(REFRESH_TOKEN, refreshToken, {
      httpOnly: true,
      maxAge: AuthService.getJWTExpiresInMilliseconds(this.configService.get(JWT.REFRESH_EXPIRES_IN)),
    });

    return true;
  }
}
