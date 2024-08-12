import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { MulterConfigService } from './multer-config.service';


@Module({
  imports: [
    MulterModule.registerAsync({
      useClass: MulterConfigService,
    }),
  ],
  providers: [],
  exports: [MulterModule],
})
export class UploadModule {}
