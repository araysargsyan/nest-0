import { registerDecorator, ValidationOptions } from 'class-validator';
import { UniqueConstraint } from '../constraints/unique.constraint';
import { IValidationArguments } from '../types';


export function IsUniqueDecorator(method: string, validationOptions?: ValidationOptions) {
  return function(object: IValidationArguments['object'], propertyName: string) {
    if (object.constructor.prototype.uniqueKeys === undefined) {
      object.constructor.prototype.uniqueKeys = {
        [propertyName]: null,
      };
    } else {
      object.constructor.prototype.uniqueKeys[propertyName] = null;
    }

    registerDecorator({
      name: 'isUnique',
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [method],
      validator: UniqueConstraint,
    });
  };
}
