import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { APP_PORT, APP_PREFIX } from '@/common/constants/global.const';
import { AppModule } from '@/modules/app.module';
import { ConfigService } from '@nestjs/config';

(async function start() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);

  // app.setGlobalPrefix(configService.get(APP_PREFIX, 'api'));
  await app.listen(configService.get(APP_PORT));

  Logger.verbose(await app.getUrl(), 'NestAppUrl');
})();
