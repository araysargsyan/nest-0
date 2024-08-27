import {
  AnyFilesInterceptor,
  FileFieldsInterceptor,
  FileInterceptor,
  FilesInterceptor,
} from '@nestjs/platform-express';
import { MulterField, MulterOptions } from '@nestjs/platform-express/multer/interfaces/multer-options.interface';
import { NestInterceptor, Type } from '@nestjs/common';


type TFileInterceptor =
  typeof FileInterceptor
  | typeof FilesInterceptor
  | typeof FileFieldsInterceptor
  | typeof AnyFilesInterceptor

interface EnhanceMulterOptions<T extends TFileInterceptor = TFileInterceptor> extends MulterOptions {
  field: T extends typeof FileInterceptor
    ? string
    : T extends typeof FilesInterceptor
      ? MulterField
      : T extends typeof FileFieldsInterceptor
        ? MulterField[]
        : null,
}

type TEnhanceFileInterceptor<T extends TFileInterceptor = TFileInterceptor> = T extends typeof AnyFilesInterceptor
  ? {
    (
      fileInterceptor: T,
      options?: MulterOptions & { errorFieldname?: string },
    ): Type<NestInterceptor>;
  }
  : {
    (
      fileInterceptor: T,
      options: T extends typeof FileFieldsInterceptor
        ? EnhanceMulterOptions<T> & { errorFieldname?: string }
        : EnhanceMulterOptions<T>,
    ): Type<NestInterceptor>;
  }

export {
  TFileInterceptor,
  EnhanceMulterOptions,
  TEnhanceFileInterceptor,
};
