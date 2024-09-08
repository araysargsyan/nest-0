import {
  MulterOptions as NestMulterOptions,
} from '@nestjs/platform-express/multer/interfaces/multer-options.interface';

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

interface INestedFileInterceptorOptions extends NestMulterOptions {
  dest: string,
  field: TNestedMulterField[]
  asyncSaveFiles?: boolean
}

type TIsValidFileReturn = {
  isValid: boolean,
  isFieldRequired?: boolean,
  error?: string
}

export {
  TNestedMulterField,
  TIsValidFileReturn,
  INestedFileInterceptorOptions,
};
