import type { ValidatorOptions as CVValidatorOptions } from 'class-validator';
import { VALIDATOR_OPTIONS } from '~constants/core.const';

//! if set to null validation will skipped even pipe is global
export function ValidatorOptions(validatorOptions: CVValidatorOptions | null = {}): (constructor: any) => void {
  return function(constructor: unknown): void {
    Reflect.defineMetadata(VALIDATOR_OPTIONS, validatorOptions, constructor)
  };
}
