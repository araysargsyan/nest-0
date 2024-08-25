import { registerDecorator, ValidationOptions } from 'class-validator';
import { ValidationArguments } from 'class-validator/types/validation/ValidationArguments';
import { UniqueConstraint } from '../constraints/unique.constraint';
import { HAS_UNIQUE, UNIQUES_METADATA } from '../constants/core.const';


export function IsUnique(method: string, validationOptions?: ValidationOptions) {
  return function(object: ValidationArguments['object'], propertyName: string) {
    Reflect.defineMetadata(HAS_UNIQUE, true, object)
    Reflect.defineMetadata(UNIQUES_METADATA, {
      status: null,
      method
    }, object, propertyName)

    registerDecorator({
      name: 'isUnique',
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [],
      // constraints: [method],
      validator: UniqueConstraint,
    });
  };
}
