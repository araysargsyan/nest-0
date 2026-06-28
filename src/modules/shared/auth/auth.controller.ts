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

import { Body, Controller, Get, HttpCode, HttpStatus, Post, Req, Res, UseGuards, UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { SignInDto, SignUpDto } from './dto';
import { IAuthResponse, ITokens, ITokenPayload } from './types';
import { ConfigService } from '@nestjs/config';
import { JwtAccessAuthGuard } from '@core/guards/jwt-access.guard';
import { JwtRefreshAuthGuard } from '@core/guards/jwt-refresh.guard';
import { ACCESS_TOKEN, REFRESH_TOKEN } from '~/constants/auth.const';
import { JWT } from '~/constants/global.const';
import { AllowExpiredAccess } from '~/decorators/allow-expired-access.decorator';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';


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
  signIn(
    @Body() dto: SignInDto,
    @Res({ passthrough: true }) res: Response
  ): Promise<Pick<IAuthResponse, 'user'>> {
    return this.authService.signIn(dto).then(
      ({ accessToken, refreshToken, user }) =>
        this.setCookie({ refreshToken, accessToken }, res) && {
          // accessToken,
          // refreshToken,
          user,
        },
    );
  }

  @Get('sign-out')
  @UseGuards(JwtAccessAuthGuard)
  @AllowExpiredAccess()
  @HttpCode(HttpStatus.OK)
  logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    console.log('CONTROLLER->logout');
    const refreshToken = req.cookies[REFRESH_TOKEN] || '';
    return this.authService.logout(req.user as ITokenPayload, refreshToken).then((cleared) => {
      res.clearCookie(REFRESH_TOKEN);
      res.clearCookie(ACCESS_TOKEN);
      if (!cleared) res.status(HttpStatus.NOT_MODIFIED);
    });
  }

  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Get('refresh')
  @UseGuards(JwtRefreshAuthGuard)
  @HttpCode(HttpStatus.OK)
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<Pick<IAuthResponse, 'user'>> {
    console.log('Controller: refresh', req.user);
    const oldRefreshToken = req.cookies[REFRESH_TOKEN];
    if (!oldRefreshToken) {
      throw new UnauthorizedException('No refresh token provided');
    }

    const tokens = await this.authService.refresh(oldRefreshToken, req.user as ITokenPayload);
    this.setCookie(tokens, res);

    return {
      user: req.user as ITokenPayload,
    };
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

  private setCookie({ refreshToken, accessToken }: Partial<ITokens>, res: Response) {
    res.cookie(REFRESH_TOKEN, refreshToken, {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      maxAge: AuthService.getJWTExpiresInMilliseconds(this.configService.get(JWT.REFRESH_EXPIRES_IN)),
    });
    res.cookie(ACCESS_TOKEN, accessToken, {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      maxAge: AuthService.getJWTExpiresInMilliseconds(this.configService.get(JWT.ACCESS_EXPIRES_IN)),
    });

    return true;
  }
}
