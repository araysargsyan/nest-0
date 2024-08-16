import { ValidationArguments as NextValidationArguments } from 'class-validator';

type TUniqueKey = null | 'pending' | boolean
export type TUniqueKeys = Record<string, TUniqueKey>

export interface IValidationArguments extends NextValidationArguments {
  object: IConstructorPrototype<{ uniqueKeys: TUniqueKeys }>;
}

export interface IUploadTypeValidatorOptions {
  fileType: string[];
  filesCount?: number;
}
