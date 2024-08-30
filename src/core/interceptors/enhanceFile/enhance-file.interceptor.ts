import {
  BadRequestException,
  CallHandler,
  ExecutionContext,
  Injectable,
  mixin,
  NestInterceptor,
  Type,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { isArray, isObject, isDefined } from 'class-validator';
import {
  AnyFilesInterceptor,
  FileFieldsInterceptor,
  FileInterceptor,
  FilesInterceptor,
} from '@nestjs/platform-express';
import { Request } from 'express';
import { MulterField, MulterOptions } from '@nestjs/platform-express/multer/interfaces/multer-options.interface';
import { v4 as uuidv4 } from 'uuid';
import {
  EnhanceMulterOptions,
  TEnhanceFileInterceptor,
  TFileInterceptor,
  TIsValidFileReturn,
  TNestedMulterField,
} from './types';
import { FILE_METADATA } from '~constants/core.const';
import { Logger } from '~logger/Logger';
import { Readable } from 'stream';
import { diskStorage } from 'multer';

//* generating unique filename field into each file object when dest=undefined
//* handling multer errors
//* passing metadata into request.route or files object(for file-validation.pipe)
//* handling nested files scenario when using AnyFilesInterceptor whit field prop
export function EnhanceFileInterceptor<T extends TFileInterceptor = TFileInterceptor>(
  ...[fileInterceptor, options]: Parameters<TEnhanceFileInterceptor<T>>
): Type<NestInterceptor> {
  @Injectable()
  class MixinInterceptor implements NestInterceptor {
    private logger = new Logger('EnhanceFileInterceptor');
    private counter: Record<string, number>;
    private requiredFieldsMap = [];

    async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<any>> {
      const {
        field,
        ...localOptions
      } = options as EnhanceMulterOptions<T> & {
        errorFieldname?: string
        asyncSaveFiles?: boolean
      };
      const {
        interceptor,
        fieldname,
      } = this.getInterceptorAndFieldNames(field, localOptions);
      this.logger.debug(`fieldNames: ${JSON.stringify({
        field,
        fieldname,
        requiredFieldsMap: this.requiredFieldsMap,
      }, null, 2)}`);

      try {
        await new interceptor().intercept(context, next);

        const request = context.switchToHttp().getRequest();
        if (fileInterceptor.name === 'AnyFilesInterceptor' && field) {
          this.nestedFieldsCheck(
            request.files,
            field as TNestedMulterField[],
          );

          if (localOptions.asyncSaveFiles) {
            await this.asyncSaveFiles(context);
          } else {
            this.generateFileNameIfNotExist(context, localOptions.dest);
          }
        } else {
          this.generateFileNameIfNotExist(context);
          this.addMetadata(fieldname, request.route);
        }

        this.logger.infoMessage('SUCCESS');
        return next.handle();
      } catch (error: any) {
        this.logger.infoMessage('ERROR');
        const errorMessage = error.response?.error;
        if (errorMessage) {
          error.response = {
            [localOptions.errorFieldname || fieldname || 'files']: [
              error.message,
            ],
          };
          error.message = errorMessage;
        } else {
        }


        throw error;
      } finally {
        this.counter && delete this.counter;
        this.requiredFieldsMap = [];
      }
    }

    private getInterceptorAndFieldNames(field: EnhanceMulterOptions['field'], localOptions: MulterOptions) {
      let interceptor: Type<NestInterceptor>;
      let fieldname: string | null = null;

      if (fileInterceptor.name === 'FileInterceptor') {
        fieldname = field as string;
        interceptor = (fileInterceptor as typeof FileInterceptor)(
          field as string,
          {
            ...localOptions,
            limits: {
              ...localOptions.limits,
              files: 1,
            },
          },
        );
      } else if (fileInterceptor.name === 'FilesInterceptor') {
        const { name, maxCount = 1 } = (field as MulterField);
        fieldname = name;
        interceptor = (fileInterceptor as typeof FilesInterceptor)(
          name,
          maxCount,
          {
            ...localOptions,
            limits: {
              ...localOptions.limits,
              files: maxCount,
            },
          },
        );
      } else if (fileInterceptor.name === 'FileFieldsInterceptor') {
        interceptor = (fileInterceptor as typeof FileFieldsInterceptor)(
          field as MulterField[],
          {
            ...localOptions,
            limits: {
              ...localOptions.limits,
              //? files: what?
            },
          },
        );
      } else if (fileInterceptor.name === 'AnyFilesInterceptor') {
        const { dest: _, storage, ...localOptionsWithoutStore } = localOptions;
        const interceptorOptions = !field ? localOptions : {
          ...localOptionsWithoutStore,
          fileFilter: (
            _: Request,
            file: Express.Multer.File,
            callback: (error: (Error | null), acceptFile: boolean) => void,
          ): void => {
            const { isValid, error } = this.isValidNested(field as TNestedMulterField[], file);

            this.logger.verbose(`Checked fieldname=${file.fieldname}`);
            this.logger.info({ isValid, error, file });
            if (!isValid) {
              callback(new BadRequestException({
                [file.fieldname]: [error],
              }), false);
              return;
            }

            callback(null, true);
          },
        };
        interceptor = (fileInterceptor as typeof AnyFilesInterceptor)(interceptorOptions);
      }

      return {
        interceptor,
        fieldname,
      };
    }

    // function generateFieldNameFromMap(fieldsMap: Express.Multer.File['fieldsMap']) {
    //   const [first, ...map] = fieldsMap;
    //   return `${first}${map.map(item => `[${item}]`).join('')}`;
    // }

    private async asyncSaveFiles(context: ExecutionContext) {
      const request = context.switchToHttp().getRequest();
      const files = request.files;
      const storage = options.storage || diskStorage({
        destination: options.dest as string,
        filename(
          _: Request,
          file: Express.Multer.File,
          callback: (error: (Error | null), filename: string) => void,
        ) {
          callback(null, file.filename);
        },
      });

      for (const file of files) {
        const filename = uuidv4();
        file.filename = filename;
        file.path = `${options.dest}/${filename}`.replace(/\//g, '\\');
        file.stream = Readable.from(file.buffer);
        await new Promise((resolve, reject) => {
          storage._handleFile(
            request,
            { ...file },
            (error: any, info: Partial<Express.Multer.File>) => {
              if (error) {
                return reject(error);
              }

              resolve(info);
            });
        });

        delete file.buffer;
        delete file.stream;
      }
    }

    private isValidNested(
      fields: TNestedMulterField[],
      file: Express.Multer.File,
    ): { isValid: boolean, error?: string } {
      const isValidFile = (
        field: TNestedMulterField,
        parentKey = '',
        required: boolean | null = null,
      ): TIsValidFileReturn => {
        const isRequired = required === null ? Boolean(field.required) : required;

        if ('nestedField' in field) {
          if (!file.fieldsMap) {
            file.fieldsMap = [];
          }
          if ('length' in field) {
            const keyPrefix = parentKey
              ? `${parentKey}[${field.key}]`
              : `${field.key}`;
            if (!file.fieldname.startsWith(keyPrefix)) {
              console.log('LENGTH: RETUNING FALSE');
              return { isValid: false };
            }
            if (field.length === Infinity) {
              console.log('LENGTH(Infinity):', { parentKey, keyPrefix, map: file.fieldsMap, field });
              const regex = new RegExp(`${keyPrefix}\\[(\\d+)\\]`);
              const match = regex.exec(file.fieldname);
              const result = match ? match[1] : null;
              file.fieldsMap.push(field.key);
              file.fieldsMap.push(+result);
              const returnResult = isValidFile(
                field.nestedField,
                `${keyPrefix}[${result}]`,
                isRequired,
              );
              if (returnResult.isValid) {
                console.log('LENGTH(Infinity): FINISH', file.fieldsMap);
                return {
                  isValid: true,
                  isFieldRequired: isRequired,
                };
              }

              return returnResult;
            } else {
              for (let i = 0; i < field.length; i++) {
                console.log('LENGTH:', { parentKey, keyPrefix, map: file.fieldsMap, field, i });

                if (file.fieldname.startsWith(`${keyPrefix}[${i}]`)) {
                  file.fieldsMap.push(field.key);
                  file.fieldsMap.push(i);
                }

                const { isValid } = isValidFile(
                  field.nestedField,
                  `${keyPrefix}[${i}]`,
                  isRequired,
                );
                if (isValid) {
                  console.log('LENGTH: FINISH', file.fieldsMap);
                  return {
                    isValid: true,
                    isFieldRequired: isRequired,
                  };
                }
              }
            }
          } else {
            const keyPrefix = parentKey
              ? `${parentKey}[${field.key}]`
              : `${field.key}`;
            console.log('WITHOUT_LENGTH:', { parentKey, keyPrefix, map: file.fieldsMap, field });
            if (!file.fieldname.startsWith(keyPrefix)) {
              console.log('WITHOUT_LENGTH: RETURNING FALSE');
              return { isValid: false };
            }

            file.fieldsMap.push(field.key);
            console.log('WITHOUT_LENGTH: FINISH', file.fieldsMap);

            return {
              ...isValidFile(field.nestedField, keyPrefix),
              isFieldRequired: isRequired,
            };
          }
        } else {
          const keyPrefix = parentKey
            ? `${parentKey}[${field.name}]`
            : `${field.name}`;
          console.log('LAST:', { parentKey, keyPrefix, map: file.fieldsMap, field });
          if (file.fieldname !== keyPrefix) {
            console.log('LAST: RETURNING FALSE');
            return { isValid: false };
          }

          file.fieldsMap.push(field.name);

          if (field.maxCount) {
            if (!this.counter) {
              this.counter = {};
            }
            if (!this.counter[file.fieldname]) {
              this.counter[file.fieldname] = 0;
            }
            this.counter[file.fieldname]++;
            if (this.counter[file.fieldname] > field.maxCount) {
              console.log('LAST(TO MANY FILES): RETURNING FALSE');
              return {
                isValid: false,
                error: 'TO MANY FILES',
              };
            }
          }

          console.log('LAST: FINISH', file.fieldsMap);
          return {
            isValid: true,
            isFieldRequired: isRequired,
          };
        }

        return { isValid: false };
      };

      let error = '';
      for (let i = 0; i < fields.length; i++) {
        const field = fields[i];
        const { isFieldRequired, ...result } = isValidFile(field);

        if (!this.requiredFieldsMap[i]) {
          this.requiredFieldsMap[i] = isFieldRequired;
        }

        this.logger.infoMessage('FINISH FIELD CHECK');
        this.logger.info({ result, field, fieldname: file.fieldname });
        if (result.isValid) {
          this.logger.infoMessage(`VALID FILE field=${JSON.stringify(field, null, 2)}`);
          return result;
        }

        if ('error' in result) {
          error = result.error;
        }

        this.logger.infoMessage(`NO-VALID FILE field=${JSON.stringify(field, null, 2)}`);
      }

      return {
        isValid: false,
        error: error || 'NOT EXIST',
      };
    }

    private nestedFieldsCheck(files: Express.Multer.File[], field: TNestedMulterField[]) {
      if (files) {
        let isHaveMissingField: boolean | any = false;

        for (let i = 0; i < (field as TNestedMulterField[]).length; i++) {
          const fi: TNestedMulterField = field[i];

          if (fi.required && !isDefined(this.requiredFieldsMap[i])) {
            isHaveMissingField = this.getNestedDefaultFieldname(fi);
            break;
          }
        }

        if (isHaveMissingField) {
          throw new BadRequestException({
            [isHaveMissingField]: ['Required'],
          });
        }
      } else {
        this.logger.warn('No Files', this.requiredFieldsMap);
        let isHaveMissingField: boolean | string = false;
        for (let i = 0; i < (field as TNestedMulterField[]).length; i++) {
          const fi: TNestedMulterField = field[i];
          if (fi.required) {
            isHaveMissingField = true;
            break;
          }
        }

        if (isHaveMissingField) {
          throw new BadRequestException({
            [this.getNestedDefaultFieldname(field[0]) || 'files']: ['Required'],
          });
        }
      }
    }

    private getNestedDefaultFieldname(field: TNestedMulterField, parentKey = '') {
      if ('nestedField' in field) {
        const keyPrefix = parentKey
          ? 'length' in field
            ? `${parentKey}[${field.key}][0]`
            : `${parentKey}[${field.key}]`
          : 'length' in field
            ? `${field.key}[0]`
            : field.key;
        return this.getNestedDefaultFieldname(field.nestedField, keyPrefix);
      } else {
        return parentKey ? `${parentKey}[${field.name}]` : `${field.name}`;
      }
    }

    private addMetadata(fieldname: string, route: Request['route']) {
      if (fileInterceptor.name === 'FileInterceptor') {
        Reflect.defineMetadata(FILE_METADATA, { fieldname }, route);
      }
      if (fileInterceptor.name === 'FilesInterceptor') {
        Reflect.defineMetadata(FILE_METADATA, { fieldname }, route);
      }
      if (fileInterceptor.name === 'FileFieldsInterceptor') {
        Reflect.defineMetadata(FILE_METADATA, { isMulti: true }, route);
      }
    }

    private generateFileNameIfNotExist(context: ExecutionContext, dest?: MulterOptions['dest']) {
      const request = context.switchToHttp().getRequest();

      if (request.file && !request.file.filename) {
        request.file.filename = uuidv4();
      }
      if (request.files) {
        if (isArray(request.files)) {
          request.files.forEach((file: Express.Multer.File) => {
            if (!file.filename) {
              file.filename = uuidv4();
              if (dest) {
                file.dest = (dest as string).replace(/\//g, '\\');
              }
            }
          });
        } else if (isObject(request.files)) {
          Object.keys(request.files).forEach((key) => {
            request.files[key].forEach((file: Express.Multer.File) => {
              if (!file.filename) {
                file.filename = uuidv4();
              }
            });
          });
        }
      }
    }
  }

  return mixin(MixinInterceptor);
}
