import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UploadModule } from './upload/upload.module';
import { RedisModule } from './redis/redis.module';
import { resolve } from 'path';
import { PUBLIC_FOLDER } from '~constants/global.const';
import { ServeStaticModule } from '@nestjs/serve-static';
import { ThrottlerModule } from '@nestjs/throttler';

@Module({
  imports: [
    ConfigModule.forRoot({
      envFilePath: '.env',
      expandVariables: true,
      isGlobal: true,
    }),
    ServeStaticModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService) => [
        {
          rootPath: resolve(configService.get(PUBLIC_FOLDER)),
        },
      ],
    }),
    ThrottlerModule.forRoot([{
      ttl: 60000,
      limit: 10,
    }]),
    PrismaModule,
    RedisModule,
    AuthModule,
    UploadModule,
  ],
  exports: [ThrottlerModule],
})
export class SharedModule {}
