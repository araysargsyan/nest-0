import { ValidatorOptions } from 'class-validator';

//! if set to null validation will skipped even pipe is global
export function ValidatorOptions(validatorOptions: ValidatorOptions | null = {}): (constructor: any) => void {
  return function(constructor: { new(): any } & { validatorOptions: ValidatorOptions | null }): void {
    constructor.validatorOptions = validatorOptions;
  };
}
