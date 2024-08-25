import { Injectable, Provider, Type } from '@nestjs/common';
import {
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';
import { ValidationArguments } from 'class-validator/types/validation/ValidationArguments';
import { UNIQUE_KEYS, UNIQUE_METHODS } from '../constants/core.const';
import { TUniqueKeys, TUniqueMethods } from '../types';

@ValidatorConstraint({ async: true, name: 'isUnique' })
@Injectable()
class UniqueConstraint implements ValidatorConstraintInterface {
  constructor(private readonly myService: Type) {
  }

  async validate(value: unknown, args: ValidationArguments): Promise<boolean> {
    // const uniqueKeys = args.object.constructor.prototype.uniqueKeys;
    const uniqueKeys: TUniqueKeys = Reflect.getMetadata(UNIQUE_KEYS, args.object);
    const methods: TUniqueMethods = Reflect.getMetadata(UNIQUE_METHODS, args.object);
    console.log(`UniqueConstraint: START(${args.property})`, { value, args, uniqueKeys, methods });

    if (uniqueKeys[args.property] === 'pending') {
      console.log('........................', args.property);
      // const isValid = await this.myService[args.constraints[0]](value);
      const isValid = await this.myService[methods[args.property]](value);
      uniqueKeys[args.property] = isValid;
      return isValid;
    }

    console.log(`UniqueConstraint: END(${args.property})`, { uniqueKeys });
    return uniqueKeys[args.property] === true || uniqueKeys[args.property] === null;
  }

  defaultMessage({property, value}: ValidationArguments): string {
    return `Property ${property} with value=${value} already exists`;
  }
}

function createUniqueConstraintProvider(service: Type): Provider {
  return {
    provide: UniqueConstraint,
    useFactory: async (serviceInstance) => new UniqueConstraint(serviceInstance),
    inject: [service],
  };
}

export {
  UniqueConstraint,
  createUniqueConstraintProvider,
};
