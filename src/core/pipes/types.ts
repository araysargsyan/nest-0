import { ValidatorOptions } from 'class-validator';

export type TExtraValidatorOptions = ValidatorOptions | null | undefined

export interface IFileValidationPipeOptions {
  fileTypes?: string[],
  fileIsRequired?: boolean | string[]
}

export type TFileValidationPipeValue = Express.Multer.File
  | Express.Multer.File[]
  | Record<string, Express.Multer.File[]>
  | undefined
