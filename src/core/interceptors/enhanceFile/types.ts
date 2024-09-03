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

type TMulterFieldWithoutNesting<T extends 'TOP' | never = 'TOP'> = {
  name: string
  maxCount?: number,


  required?: T extends 'TOP' ? boolean : never,
  fileTypes?: T extends 'TOP' ? string[] : never
  length?: never,
  nestedField?: never
  key?: never
}

type TNestedMulterField<T extends 'TOP' | never = 'TOP'> = {
  nestedField: TMulterFieldWithoutNesting<T extends 'TOP' ? never : 'TOP'>
    | TNestedMulterField<T extends 'TOP' ? never : 'TOP'>
  key: string,
  length?: number,

  required?: T extends 'TOP' ? boolean : never,
  fileTypes?: T extends 'TOP' ? string[] : never,
  maxCount?: never,
  name?: never,
} | TMulterFieldWithoutNesting<T>

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
        ? Array<MulterField & {
          fileTypes?: string[]
        }>
        : null,
}

interface IAnyFileInterceptorOptions extends NestMulterOptions {
  dest: string,
  field: TNestedMulterField[]
  asyncSaveFiles?: boolean

  errorFieldname?: never
}

type EnhanceMulterOptions<T extends TFileInterceptor = TFileInterceptor> = T extends typeof AnyFilesInterceptor
  ? (IAnyFileInterceptorOptions | (NestMulterOptions & {
    errorFieldname?: string

    field?: never
    asyncSaveFiles?: never
  }))
  : T extends typeof FileFieldsInterceptor ? MulterOptions<T> & { errorFieldname?: string } : MulterOptions<T>

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
  TIsValidFileReturn,
};
