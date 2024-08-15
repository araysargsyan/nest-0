import { ValidatorOptions } from 'class-validator';
import { ArgumentMetadata } from '@nestjs/common';


export interface IArgumentMetadataGP extends ArgumentMetadata {
  metatype?: ArgumentMetadata['metatype'] & {
    validatorOptions?: ValidatorOptions | null;
    uniqueKeys?: Record<string, null | 'pending' | boolean>;
  };
}
export interface FileValidationPipeAM extends ArgumentMetadata {
  metatype?: ArgumentMetadata['metatype'] & {
    filesCount?: number,
    fieldname?: string | string[]
  };
}
export interface IFileValidationPipeOptions {
  fileType?: string[],
  fileIsRequired?: boolean | NonEmptyArray<string>
}
