import { ValidationArguments as NextValidationArguments } from 'class-validator';
import { TUniqueKeys } from '@core/pipes/types';

export interface IValidationArguments extends NextValidationArguments {
  object: IConstructorPrototype<{ uniqueKeys: TUniqueKeys }>;
}
