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
import {
  AnyFilesInterceptor,
  FileFieldsInterceptor,
  FileInterceptor,
  FilesInterceptor,
} from '@nestjs/platform-express';
import { MulterField, MulterOptions } from '@nestjs/platform-express/multer/interfaces/multer-options.interface';
import { Logger } from '~logger/Logger';
import { FILE_METADATA } from '~constants/core.const';

type TFileInterceptor =
  typeof FileInterceptor
  | typeof FilesInterceptor
  | typeof FileFieldsInterceptor
  | typeof AnyFilesInterceptor

interface EnhanceMulterOptions<T extends TFileInterceptor = TFileInterceptor> extends MulterOptions {
  field: T extends typeof FileInterceptor
    ? string
    : T extends typeof FilesInterceptor
      ? MulterField
      : T extends typeof FileFieldsInterceptor
        ? MulterField[]
        : null,
}

type TEnhanceFileInterceptor<T extends TFileInterceptor = TFileInterceptor> = T extends typeof AnyFilesInterceptor
  ? {
    (
      fileInterceptor: T,
      options?: MulterOptions & { errorFieldname?: string },
    ): Type<NestInterceptor>;
  }
  : {
    (
      fileInterceptor: T,
      options: T extends typeof FileFieldsInterceptor
        ? EnhanceMulterOptions<T> & { errorFieldname?: string }
        : EnhanceMulterOptions<T>,
    ): Type<NestInterceptor>;
  }

//* generating unique filename field into each file object when dest=undefined
//* handling multer errors
//* passing metadata into file or files object(for file-validation.pipe)
export function EnhanceFileInterceptor<T extends TFileInterceptor = TFileInterceptor>(
  ...[fileInterceptor, options = {
    field: null,
  }]: Parameters<TEnhanceFileInterceptor<T>>
): Type<NestInterceptor> {
  @Injectable()
  class MixinInterceptor implements NestInterceptor {
    private logger = new Logger('EnhanceFileInterceptor');
    // private readonly nestedKeyRegex: RegExp = /\[([^\]]+)]/g;

    async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<any>> {
      const {
        errorFieldname,
        field,
        ...localOptions
      } = options as EnhanceMulterOptions<T> & { errorFieldname?: string };
      const {
        interceptor,
        fieldname,
      } = this.getInterceptorAndFieldNames(field, localOptions);
      this.logger.debug(`fieldNames: ${JSON.stringify({field, fieldname}, null, 2)}`);
      // const match = this.nestedKeyRegex.exec((field as any).name);

      try {
        await new interceptor().intercept(context, next);
        this.logger.infoMessage('SUCCESS');
        this.generateFileNameIfNotExist(context, fieldname);

        return next.handle();
      } catch (error: any) {
        this.logger.infoMessage('ERROR');
        const errorMessage = error.response?.error;
        error.response = {
          [errorFieldname || fieldname || 'files']: [
            error.message,
          ],
        };
        error.message = errorMessage;

        throw error;
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
        interceptor = (fileInterceptor as typeof AnyFilesInterceptor)(localOptions);
      }

      return {
        interceptor,
        fieldname,
      };
    }

    private generateFileNameIfNotExist(context: ExecutionContext, fieldname: string | null) {
      const request = context.switchToHttp().getRequest();

      if (request.file && !request.file.filename) {
        request.file.filename = uuidv4();
      }
      if (request.files) {
        if (isArray(request.files)) {
          request.files.forEach((file: Express.Multer.File) => {
            if (!file.filename) {
              file.filename = uuidv4();
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

      if (fileInterceptor.name === 'FileInterceptor') {
        // if (!request.file) {
        //   request.file = {};
        // }
        // request.file.constructor.fieldname = fieldname;

        Reflect.defineMetadata(FILE_METADATA, { fieldname }, request.route)
      }

      if (fileInterceptor.name === 'FilesInterceptor') {
        // if (!request.files.length) {
        //   request.files = [];
        // }
        // request.files.constructor.fieldname = fieldname;
        Reflect.defineMetadata(FILE_METADATA, { fieldname }, request.route)

      }

      if (fileInterceptor.name === 'FileFieldsInterceptor'/* && request.files*/) {
        // request.files = { ...request.files };
        // request.files.constructor.isMulti = true;
        Reflect.defineMetadata(FILE_METADATA, { isMulti: true }, request.route)
      }
    }
  }

  return mixin(MixinInterceptor);
}
