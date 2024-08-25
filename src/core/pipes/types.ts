import { ValidatorOptions } from 'class-validator';

type NonEmptyArray<T> = [T, ...T[]];
export type TExtraValidatorOptions = ValidatorOptions | null | undefined

export interface IFileValidationPipeOptions {
  fileType?: string[],
  fileIsRequired?: boolean | NonEmptyArray<string>
}

export type TFileValidationPipeValue = Express.Multer.File
  | Express.Multer.File[]
  | Record<string, Express.Multer.File[]>
  | undefined

