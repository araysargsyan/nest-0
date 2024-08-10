import { Injectable, Provider, Type } from '@nestjs/common';
import {
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';
import { IValidationArguments } from '../types';

@ValidatorConstraint({ async: true, name: 'isUnique' })
@Injectable()
class UniqueConstraint implements ValidatorConstraintInterface {
  constructor(private readonly myService: Type) {
  }

  async validate(value: any, args: IValidationArguments): Promise<boolean> {
    const uniqueKeys = args.object.constructor.prototype.uniqueKeys;
    console.log(`UniqueConstraint: START(${args.property})`, { value, args, uniqueKeys });

    if (uniqueKeys[args.property] === 'pending') {
      console.log('........................', args.property);
      const isValid = await this.myService[args.constraints[0]](value);
      uniqueKeys[args.property] = isValid;
      return isValid;
    }

    console.log(`UniqueConstraint: END(${args.property})`, { uniqueKeys });
    return uniqueKeys[args.property] === true || uniqueKeys[args.property] === null;
  }

  defaultMessage(): string {
    return 'Email $value уже используется';
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
