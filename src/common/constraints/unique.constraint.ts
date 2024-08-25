import { Injectable, Provider, Type } from '@nestjs/common';
import {
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';
import { ValidationArguments } from 'class-validator/types/validation/ValidationArguments';
import { IUniquesMetadata } from '../types';
import { UNIQUES_METADATA } from '~constants/core.const';

@ValidatorConstraint({ async: true, name: 'isUnique' })
@Injectable()
class UniqueConstraint implements ValidatorConstraintInterface {
  constructor(private readonly myService: Type) {
  }

  async validate(value: unknown, args: ValidationArguments): Promise<boolean> {
    const uniquesMedata = Reflect.getMetadata(
      UNIQUES_METADATA, args.object, args.property
    ) as IUniquesMetadata
    console.log(`UniqueConstraint: START(${args.property})`, { value, args, uniquesMedata });

    if (uniquesMedata.status === 'pending') {
      console.log('........................', args.property);
      const isValid = await this.myService[uniquesMedata.method](value);
      uniquesMedata.status = isValid

      return isValid;
    }

    console.log(`UniqueConstraint: END(${args.property})`, { uniquesMedata });
    return uniquesMedata.status === true || uniquesMedata.status === null;
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
