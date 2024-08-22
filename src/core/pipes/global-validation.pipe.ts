import { BadRequestException, Inject, Injectable, PipeTransform, Scope, ValidationError } from '@nestjs/common';
import { validate, ValidatorOptions } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { IArgumentMetadataGP } from './types';
import { REQUEST } from '@nestjs/core';
import { Request } from 'express';
import { TUniqueKeys } from '~types';
import { Logger } from '~logger/Logger';

@Injectable({scope: Scope.REQUEST})
export class GlobalValidationPipe implements PipeTransform {
  private readonly logger = new Logger('GlobalValidationPipe')
  private validatorOptions: ValidatorOptions = {
    skipMissingProperties: false,
    skipUndefinedProperties: false,
    skipNullProperties: false,
    whitelist: true,
    forbidNonWhitelisted: true,
    forbidUnknownValues: true,
  };

  constructor(
    @Inject(REQUEST) protected readonly request: Request,
  ) {}

  async transform(value: unknown, metadata: IArgumentMetadataGP) {
    const extraValidationOptions = metadata.metatype?.validatorOptions;
    const skipValidation = extraValidationOptions === null || metadata.type === 'custom';

    if (skipValidation) {
      this.logger.debug(`Skip ${metadata.type}`)
      return value;
    }

    this.logger.debug(`START -> ${JSON.stringify({
      metadata,
      value,
      skipValidation,
      extraValidationOptions,
    }, null, 2)}`);

    const { instance, errors } = await this.validate(metadata.metatype, value, extraValidationOptions);

    this.logger.debug(`FINISH -> ${JSON.stringify({instance, errors}, null, 2)}`)

    if (errors) {
      this.logger.infoMessage('BODY WAS ERRORED')
      this.request.body = {...this.request.body}
      this.request.body.constructor.prototype._errored = true;
      this.logger.info(new BadRequestException(errors))
      throw new BadRequestException(errors);
    }

    return instance;
  }

  private async validate(metatype: IArgumentMetadataGP['metatype'], value: unknown, extraValidationOptions: ValidatorOptions) {
    const uniqueKeys: TUniqueKeys = metatype.prototype.uniqueKeys;
    const errors: ValidationError[] = [];
    const validatorOptions = {
      ...this.validatorOptions,
      ...extraValidationOptions,
    }

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
        });

        errors.push(...(await validate(uniqueInstance, {
          ...validatorOptions,
          stopAtFirstError: true,
        })));

        // console.log('after validate unique', { key, errors, uniqueKeys });

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

      errors.push(...(await validate(noneUniqueInstance, validatorOptions)));

      // console.log('after validate all', { errors, uniqueKeys });

      return {
        instance: plainToInstance(metatype, value),
        errors: this.extractErrors(errors),
      };
    } else {
      const instance = plainToInstance(metatype, value);

      return {
        instance: instance,
        errors: this.extractErrors(await validate(instance, validatorOptions)),
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
