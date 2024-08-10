import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtModule } from '@nestjs/jwt';
import { AccessStrategy } from '@core/guards/strategies/access.strategy';
import { RefreshStrategy } from '@core/guards/strategies/refresh.strategy';
import { UserModule } from '@modules/user/user.module';

@Module({
  imports: [JwtModule.register({}), UserModule],
  providers: [AuthService, AccessStrategy, RefreshStrategy],
  controllers: [AuthController],
})
export class AuthModule {}
