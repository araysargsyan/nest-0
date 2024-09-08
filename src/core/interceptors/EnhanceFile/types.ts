import {
  AnyFilesInterceptor,
  FileFieldsInterceptor,
  FileInterceptor,
  FilesInterceptor,
} from '@nestjs/platform-express';
import {
  MulterField,
  MulterOptions as NestMulterOptions,
} from '@nestjs/platform-express/multer/interfaces/multer-options.interface';
import { NestInterceptor, Type } from '@nestjs/common';
import { INestedFileInterceptorOptions, NestedFilesInterceptor } from '../nestedFilesInterceptor';


type TFileInterceptor =
  typeof FileInterceptor
  | typeof FilesInterceptor
  | typeof FileFieldsInterceptor
  | typeof AnyFilesInterceptor
  | typeof NestedFilesInterceptor

interface MulterOptions<T extends TFileInterceptor = TFileInterceptor> extends NestMulterOptions {
  field: T extends typeof FileInterceptor
    ? string
    : T extends typeof FilesInterceptor
      ? MulterField
      : T extends typeof FileFieldsInterceptor
        ? Array<MulterField & {
          fileTypes?: string[]
        }>
        : null,
}

type EnhanceMulterOptions<T extends TFileInterceptor = TFileInterceptor> = T extends typeof AnyFilesInterceptor
  ? (NestMulterOptions & {
    errorFieldname?: string
    field?: never
  })
  : T extends typeof FileFieldsInterceptor
    ? MulterOptions<T> & { errorFieldname?: string }
    : T extends typeof NestedFilesInterceptor
      ? INestedFileInterceptorOptions
      : MulterOptions<T>

type TEnhanceFileInterceptor<T extends TFileInterceptor = TFileInterceptor> = {
  (
    fileInterceptor: T,
    options: EnhanceMulterOptions<T>,
  ): Type<NestInterceptor>;
}

export {
  TFileInterceptor,
  EnhanceMulterOptions,
  TEnhanceFileInterceptor
};
