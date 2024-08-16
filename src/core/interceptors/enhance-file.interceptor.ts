import {
  CallHandler,
  ExecutionContext,
  Injectable,
  mixin,
  NestInterceptor,
  Type,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { v4 as uuidv4 } from 'uuid';
import { isArray, isObject } from 'class-validator';
import { FileFieldsInterceptor, FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { MulterField, MulterOptions } from '@nestjs/platform-express/multer/interfaces/multer-options.interface';
import { Logger } from '~logger/Logger';
type TFileInterceptor = typeof FileInterceptor | typeof FilesInterceptor | typeof FileFieldsInterceptor;

export function EnhanceFileInterceptor<T extends TFileInterceptor = TFileInterceptor>(
  fileInterceptor: T,
  field: T extends typeof FileInterceptor
    ? string
    : T extends typeof FilesInterceptor
      ? MulterField
      : MulterField[],
  localOptions: MulterOptions = {},
): Type<NestInterceptor> {
  @Injectable()
  class MixinInterceptor implements NestInterceptor {
    private logger = new Logger('EnhanceFileInterceptor')

    async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<any>> {
      const {
        interceptor,
        fieldNames
      } = this.getInterceptorAndFieldNames();
      this.logger.debug(`fieldNames: ${JSON.stringify(fieldNames, null, 2)}`);

      try {
        await new interceptor().intercept(context, next);
        this.logger.infoMessage('SUCCESS');
        this.generateFileNameIfNotExist(context, fieldNames)

        return next.handle();
      } catch (error: any) {
        this.logger.infoMessage('ERROR');
        const errorMessage = error.response?.error;
        error.response = {
          [this.getFieldNames(fieldNames) || 'file']: [
            error.message,
          ],
        };
        error.message = errorMessage;

        throw error;
      }
    }

    private getFieldNames(fieldNames: string | string[]) {
      return isArray(fieldNames) ? 'MultiFile' : fieldNames
    }
    private getInterceptorAndFieldNames() {
      let interceptor: Type<NestInterceptor>;
      let fieldNames: string | string[];

      if (fileInterceptor.name === 'FileInterceptor') {
        fieldNames = field as string;
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
        fieldNames = name;
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
        let maxCount = 0
        fieldNames = (field as MulterField[]).map((field) => {
          maxCount = maxCount + field.maxCount
          return field.name
        });

        interceptor = (fileInterceptor as typeof FileFieldsInterceptor)(
          field as MulterField[],
          {
            ...localOptions,
            limits: {
              ...localOptions.limits,
              files: maxCount,
            },
          },
        );
      }

      return {
        interceptor,
        fieldNames,
      };
    }
    private generateFileNameIfNotExist(context: ExecutionContext, fieldName: string | string[]) {
      const req = context.switchToHttp().getRequest();
      let filesCount = 0

      if (req.file && !req.file.filename) {
        req.file.filename = uuidv4();
        filesCount = 1
      }
      if (req.files) {
        if(isArray(req.files)) {
          filesCount = req.files.length
          req.files.forEach((file: Express.Multer.File) => {
            if (!file.filename) {
              file.filename = uuidv4();
            }
          });
        } else if (isObject(req.files)) {
          Object.keys(req.files).forEach((key) => {
            filesCount = filesCount + req.files[key].length
            req.files[key].forEach((file: Express.Multer.File) => {
              if (!file.filename) {
                file.filename = uuidv4();
              }
            });
          })
        }
      }

      if (fileInterceptor.name === 'FileInterceptor') {
        if (!req.file) {
          req.file = {}
        }
        req.file.constructor.fieldname = fieldName
        req.file.constructor.filesCount = filesCount
      }

      if (fileInterceptor.name === 'FilesInterceptor' && req.files) {
        req.files.constructor.fieldname = fieldName
        req.files.constructor.filesCount = filesCount
      }

      if (fileInterceptor.name === 'FileFieldsInterceptor'/* && req.files*/) {
        req.files = {...req.files}
        req.files.constructor.fieldname = fieldName
        req.files.constructor.filesCount = filesCount
      }
    }
  }

  return mixin(MixinInterceptor);
}
