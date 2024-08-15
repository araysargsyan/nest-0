import { ValidatorOptions } from 'class-validator';
import { ArgumentMetadata as NextArgumentMetadata } from '@nestjs/common';


type TUniqueKey = null | 'pending' | boolean
export type TUniqueKeys = Record<string, TUniqueKey>

export interface IArgumentMetadata extends NextArgumentMetadata {
  metatype?: NextArgumentMetadata['metatype'] & {
    validatorOptions?: ValidatorOptions | null;
    uniqueKeys?: Record<string, null | 'pending' | boolean>;
  };
}

export interface IFileValidationPipeOptions {
  fileType?: string[],
  fileIsRequired?: boolean | NonEmptyArray<string>
}

export const FIELD_NAME_FROM_REQ = 'FIELD_NAME_FROM_REQ' as const;
export const PARSE_JSON = 'PARSE_JSON' as const;
