import {
  BadRequestException,
  Injectable,
  PipeTransform, ValidationError,
} from '@nestjs/common';
import { validate, ValidatorOptions } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { IArgumentMetadata, TUniqueKeys } from './types';

@Injectable()
export class GlobalValidationPipe implements PipeTransform {
  private validatorOptions: ValidatorOptions = {
    skipMissingProperties: false,
    skipUndefinedProperties: false,
    skipNullProperties: false,
    whitelist: true,
    forbidNonWhitelisted: true,
    forbidUnknownValues: true,
  };

  async transform(value: unknown, metadata: IArgumentMetadata) {
    console.log('GlobalValidationPipe: START', metadata.metatype);
    const extraValidationOptions = metadata.metatype?.validatorOptions;
    const skipValidation = extraValidationOptions === null;

    if (skipValidation) return value;

    const { instance, errors } = await this.validate(metadata.metatype, value, extraValidationOptions);
    console.log('GlobalValidationPipe: FINISH', { instance, errors });
    if (errors) {
      throw new BadRequestException(errors);
    }

    return instance;
  }

  private async validate(metatype: IArgumentMetadata['metatype'], value: unknown, extraValidationOptions: ValidatorOptions) {
    const uniqueKeys: TUniqueKeys = metatype.prototype.uniqueKeys;
    const errors: ValidationError[] = [];

    if (uniqueKeys) {
      const uniqueKeysArr = Object.keys(uniqueKeys);

      for (let i = 0; i < uniqueKeysArr.length; i++) {
        const key = uniqueKeysArr[i];
        (metatype.prototype.uniqueKeys as TUniqueKeys)[key] = 'pending';
        const uniqueInstance = plainToInstance(metatype, value, {
          targetMaps: [{
            target: metatype,
            properties: { [key]: metatype },
          }],
          // excludePrefixes: Object.keys(value).filter((k) => k !== key)
        });

        errors.push(...(await validate(uniqueInstance, {
          ...this.validatorOptions,
          ...extraValidationOptions,
          stopAtFirstError: true,
        })));

        console.log('after validate uniques', { key, errors, uniqueKeys });

        if (errors.length) break;
      }

      uniqueKeysArr.forEach((key) => {
        uniqueKeys[key] = null;
      });

      if (errors.length) {
        return {
          instance: plainToInstance(metatype, value),
          errors: this.extractErrors(errors),
        };
      }

      const noneUniqueProperties = {};
      Object.keys(value).forEach((key) => {
        if (!uniqueKeysArr.includes(key)) {
          noneUniqueProperties[key] = metatype;
        }
      });
      const noneUniqueInstance = plainToInstance(metatype, value, {
        targetMaps: [{
          target: metatype,
          properties: noneUniqueProperties,
        }],
      });

      errors.push(...(await validate(noneUniqueInstance, {
        ...this.validatorOptions,
        ...extraValidationOptions,
      })));

      console.log('after validate all', { errors, uniqueKeys });

      return {
        instance: plainToInstance(metatype, value),
        errors: this.extractErrors(errors),
      };
    } else {
      const instance = plainToInstance(metatype, value);

      return {
        instance: instance,
        errors: this.extractErrors(await validate(instance, {
          ...this.validatorOptions,
          ...extraValidationOptions,
          stopAtFirstError: true,
        })),
      };
    }
  }

  private extractErrors(errors: ValidationError[]) {
    const errorsObj: Record<string, Array<string>> = errors.length ? {} : null;
    errors.forEach((err) => {
      errorsObj[err.property] = Object.values(err.constraints);
    });

    return errorsObj;
  }
}
