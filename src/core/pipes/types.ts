import { ValidatorOptions } from 'class-validator';
import { ArgumentMetadata } from '@nestjs/common';


export interface IArgumentMetadataGP extends ArgumentMetadata {
  metatype?: ArgumentMetadata['metatype'] & {
    validatorOptions?: ValidatorOptions | null;
    uniqueKeys?: Record<string, null | 'pending' | boolean>;
  };
}
export interface IFileValidationPipeOptions {
  fileType?: string[],
  fileIsRequired?: boolean | NonEmptyArray<string>
}

export type TValue = Express.Multer.File
  | Express.Multer.File[]
  | Record<string, Express.Multer.File[]>
  | undefined

