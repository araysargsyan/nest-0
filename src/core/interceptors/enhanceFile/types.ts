import {
  AnyFilesInterceptor,
  FileFieldsInterceptor,
  FileInterceptor,
  FilesInterceptor,
} from '@nestjs/platform-express';
import { MulterField, MulterOptions as NestMulterOptions } from '@nestjs/platform-express/multer/interfaces/multer-options.interface';
import { NestInterceptor, Type } from '@nestjs/common';

type TMulterFieldWithoutNesting = {
  name: string
  maxCount?: number,
  fileTypes?: string[],

  length?: never,
  nestedField?: never
  key?: never
}

type TNestedMulterField<T extends 'REQUIRED' | never = 'REQUIRED'> = {
  nestedField: TMulterFieldWithoutNesting | TNestedMulterField<never>
  key: string,
  length?: number,

  required?: T extends 'REQUIRED' ? boolean : never,
  maxCount?: never,
  name?: never,
  fileTypes?: never,
} | (TMulterFieldWithoutNesting & {
  required?: boolean,
})

type TIsValidFileReturn = {
  isValid: boolean,
  isFieldRequired?: boolean,
  error?: string
}


type TFileInterceptor =
  typeof FileInterceptor
  | typeof FilesInterceptor
  | typeof FileFieldsInterceptor
  | typeof AnyFilesInterceptor

interface MulterOptions<T extends TFileInterceptor = TFileInterceptor> extends NestMulterOptions {
  field: T extends typeof FileInterceptor
    ? string
    : T extends typeof FilesInterceptor
      ? MulterField
      : T extends typeof FileFieldsInterceptor
        ? MulterField[]
        : null,
}
interface IAnyFileInterceptorOptions extends NestMulterOptions {
  dest: string,
  field: TNestedMulterField[]
  asyncSaveFiles?: boolean

  errorFieldname?: never
}

type EnhanceMulterOptions<T extends TFileInterceptor = TFileInterceptor> = T extends typeof AnyFilesInterceptor ? (IAnyFileInterceptorOptions | (NestMulterOptions & {
  errorFieldname?: string

  field?: never
  asyncSaveFiles?: never
})) : T extends typeof FileFieldsInterceptor ? MulterOptions<T> & { errorFieldname?: string} : MulterOptions<T>

type TEnhanceFileInterceptor<T extends TFileInterceptor = TFileInterceptor> = {
    (
      fileInterceptor: T,
      options: EnhanceMulterOptions<T>,
    ): Type<NestInterceptor>;
  }

export {
  TFileInterceptor,
  EnhanceMulterOptions,
  TEnhanceFileInterceptor,
  TNestedMulterField,
  TIsValidFileReturn
};
