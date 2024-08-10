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
