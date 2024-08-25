import {
  ArgumentMetadata,
  BadRequestException,
  Inject,
  Injectable,
  InternalServerErrorException,
  PipeTransform,
  Scope,
  ValidationError,
} from '@nestjs/common';
import { validate, ValidatorOptions } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { IArgumentMetadataGP } from './types';
import { REQUEST } from '@nestjs/core';
import { Request } from 'express';
import { IUniquesMetadata } from '~types';
import { Logger } from '~logger/Logger';
import { BODY_ERRORED, HAS_UNIQUE, UNIQUES_METADATA } from '~constants/core.const';

@Injectable({ scope: Scope.REQUEST })
export class GlobalValidationPipe implements PipeTransform {
  private readonly logger = new Logger('GlobalValidationPipe');
  private validatorOptions: ValidatorOptions = {
    skipMissingProperties: false,
    skipUndefinedProperties: false,
    skipNullProperties: false,
    whitelist: true,
    forbidNonWhitelisted: true,
    forbidUnknownValues: true,
  };
  fileMetatype: ArgumentMetadata['metatype'];

  constructor(
    @Inject(REQUEST) protected readonly request: Request,
  ) {
  }

  async transform(value: unknown, metadata: IArgumentMetadataGP) {
    const extraValidationOptions = metadata.metatype?.validatorOptions;
    const skipValidation = metadata.type === 'custom'
      || extraValidationOptions === null
      || this.isNotDto(metadata.metatype?.name);

    if (metadata.type === 'custom') {
      this.fileMetatype = metadata.metatype;
    }

    if (skipValidation) {
      this.logger.debug(`Skip ${metadata.type}`);
      return value;
    }

    this.logger.debug(`START -> ${JSON.stringify({
      metadata,
      value,
      skipValidation,
      extraValidationOptions,
    }, null, 2)}`);

    try {
      const { instance, errors } = await this.validate(metadata.metatype, value, extraValidationOptions);
      this.logger.debug(`FINISH -> ${JSON.stringify({ instance, errors }, null, 2)}`);

      if (errors) {
        this.logger.error('BODY WAS ERRORED');
        throw new BadRequestException(errors);
      }

      delete this.fileMetatype;
      this.request.body = { ...instance };
      return instance;
    } catch (error) {
      // this.request.body = { ...this.request.body };
      // this.request.body.constructor.prototype._errored = true;
      if (this.fileMetatype) {
        Reflect.defineMetadata(BODY_ERRORED, true, this.fileMetatype);
        delete this.fileMetatype;
      }

      if (error instanceof BadRequestException) {
        throw error;
      }

      throw new InternalServerErrorException(error);
    }
  }

  private async validate(metatype: IArgumentMetadataGP['metatype'], value: unknown, extraValidationOptions: ValidatorOptions) {
    const errors: ValidationError[] = [];
    const validatorOptions = {
      ...this.validatorOptions,
      ...extraValidationOptions,
    };

    if (Boolean(Reflect.getMetadata(HAS_UNIQUE, metatype.prototype))) {
      const uniqueKeysArr = [];
      const valueKeys = Object.keys(value);

      for (let i = 0; i < valueKeys.length; i++) {
        const key = valueKeys[i];
        const uniquesMetadata: IUniquesMetadata = Reflect.getMetadata(
          UNIQUES_METADATA, metatype.prototype, key
        );
        if (uniquesMetadata) {
          uniqueKeysArr.push(key)
          uniquesMetadata.status = 'pending';

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

          uniquesMetadata.status = null;

          // console.log('after validate unique', { key, errors, uniqueKeys });

          if (errors.length) break;
        }
      }

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

  private isNotDto(name: string) {
    return name === undefined
      || name === 'Object'
      || name === 'Array'
      || name === 'Boolean'
      || name === 'String'
      || name === 'Number';
  }
}
