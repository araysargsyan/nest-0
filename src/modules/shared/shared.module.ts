import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UploadModule } from './upload/upload.module';
import { resolve } from 'path';
import { PUBLIC_FOLDER } from '~constants/global.const';
import { ServeStaticModule } from '@nestjs/serve-static';

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
    PrismaModule,
    AuthModule,
    UploadModule,
  ],
})
export class SharedModule {}
