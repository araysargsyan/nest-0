import { AnyFilesInterceptor } from '@nestjs/platform-express';
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
import { isDefined } from 'class-validator';
import { Logger } from '~logger/Logger';
import { Request } from 'express';
import { diskStorage } from 'multer';
import { v4 as uuidv4 } from 'uuid';
import { Readable } from 'stream';
import {
  INestedFileInterceptorOptions,
  TIsValidFileReturn,
  TNestedMulterField
} from './types';


export default function NestedFilesInterceptor(
  {
    field,
    ...localOptions
  }: INestedFileInterceptorOptions,
): Type<NestInterceptor> {
  @Injectable()
  class MixinInterceptor implements NestInterceptor {
    private logger = new Logger('NestedFileInterceptor');
    private counter: Record<string, number>;
    private requiredFieldsMap = [];

    async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<any>> {
      const localOptionsWithoutStore = { ...localOptions };
      delete localOptionsWithoutStore.storage;
      delete localOptionsWithoutStore.dest;
      const interceptorOptions = {
        ...localOptionsWithoutStore,
        fileFilter: (
          req: Request,
          file: Express.Multer.File,
          callback: (error: (Error | null), acceptFile: boolean) => void,
        ): void => {
          const { isValid, error } = this.isValidNested(field, file);

          this.logger.verbose(`Checked fieldname=${file.fieldname}`);
          this.logger.info({ isValid, error, file });
          if (!isValid) {
            callback(new BadRequestException({
              [file.fieldname]: [error],
            }), false);
            return;
          }

          if (localOptions.fileFilter) {
            localOptions.fileFilter(req, file, callback);
          } else {
            callback(null, true);
          }
        },
      };
      const interceptor = AnyFilesInterceptor(interceptorOptions);

      try {
        await new interceptor().intercept(context, next);
        const request = context.switchToHttp().getRequest();

        this.nestedFieldsCheck(
          request.files,
          field as TNestedMulterField[],
        );

        if (localOptions.asyncSaveFiles) {
          await this.asyncSaveFiles(context);
        }

        return next.handle();
      } catch (error) {
        throw error
      } finally {
        this.counter && delete this.counter;
        this.requiredFieldsMap = [];
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
          if (field.fileTypes) {
            file.fileTypes = field.fileTypes;
          }
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

    private async asyncSaveFiles(context: ExecutionContext) {
      const request = context.switchToHttp().getRequest();
      const files = request.files;
      const storage = localOptions.storage || diskStorage({
        destination: localOptions.dest,
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
        file.path = `${localOptions.dest}/${filename}`.replace(/\//g, '\\');
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

    // function generateFieldNameFromMap(fieldsMap: Express.Multer.File['fieldsMap']) {
    //   const [first, ...map] = fieldsMap;
    //   return `${first}${map.map(item => `[${item}]`).join('')}`;
    // }
  }

  return mixin(MixinInterceptor);
}
