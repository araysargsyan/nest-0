import { Injectable } from '@nestjs/common';
import { MulterModuleOptions, MulterOptionsFactory } from '@nestjs/platform-express';
import { ConfigService } from '@nestjs/config';
import { PUBLIC_FOLDER } from '~constants/global.const';
import { existsSync, mkdirSync } from 'fs';

@Injectable()
export class MulterConfigService implements MulterOptionsFactory {
  uploadsCoreDestination = '';
  uploadsFolder = 'uploads'

  constructor(private readonly configService: ConfigService) {
    this.uploadsCoreDestination = `${configService.get(PUBLIC_FOLDER, 'public')}\\${this.uploadsFolder}`;
  }
  createMulterOptions(): MulterModuleOptions {
    if (!existsSync(this.uploadsCoreDestination)) {
      mkdirSync(this.uploadsCoreDestination, { recursive: true });
    }

    return {
      dest: this.uploadsCoreDestination,
    };
  }
}
