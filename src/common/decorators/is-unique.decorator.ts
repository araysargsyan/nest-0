import { registerDecorator, ValidationOptions } from 'class-validator';
import { ValidationArguments } from 'class-validator/types/validation/ValidationArguments';
import { UniqueConstraint } from '../constraints/unique.constraint';
import { TUniqueKeys, TUniqueMethods } from '../types';
import { UNIQUE_KEYS, UNIQUE_METHODS } from '../constants/core.const';


export function IsUnique(method: string, validationOptions?: ValidationOptions) {
  return function(object: ValidationArguments['object'], propertyName: string) {
    const uniqueKeys: TUniqueKeys = Reflect.getMetadata(UNIQUE_KEYS, object)
    const uniqueMethods: TUniqueMethods = Reflect.getMetadata(UNIQUE_METHODS, object)

    if(!uniqueMethods) {
      Reflect.defineMetadata(UNIQUE_METHODS, {
        [propertyName]: method
      }, object)
    } else {
      uniqueMethods[propertyName] = method
    }

    if (uniqueKeys === undefined) {
      Reflect.defineMetadata(UNIQUE_KEYS, {
        [propertyName]: null
      }, object)
      // object.constructor.prototype.uniqueKeys = {
      //   [propertyName]: null,
      // };
    } else {
      uniqueKeys[propertyName] = null
      // object.constructor.prototype.uniqueKeys[propertyName] = null;
    }

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
