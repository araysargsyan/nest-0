import {
  CallHandler,
  ExecutionContext,
  Injectable,
  mixin,
  NestInterceptor,
  Type,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { isArray, isObject } from 'class-validator';
import {
  FileFieldsInterceptor,
  FileInterceptor,
  FilesInterceptor,
} from '@nestjs/platform-express';
import { v4 as uuidv4 } from 'uuid';
import { Logger } from '~logger/Logger';
import { FILE_METADATA } from '~constants/core.const';
import { Request } from 'express';
import { MulterField, MulterOptions } from '@nestjs/platform-express/multer/interfaces/multer-options.interface';
import {
  EnhanceMulterOptions,
  TEnhanceFileInterceptor,
  TFileInterceptor,
} from './types';


//* generating unique filename field into each file object when dest=undefined
//* handling multer errors
//* passing metadata into request.route or files object(for file-validation.pipe)
export default function EnhanceFileInterceptor<T extends TFileInterceptor = TFileInterceptor>(
  ...[fileInterceptor, options]: Parameters<TEnhanceFileInterceptor<T>>
): Type<NestInterceptor> {
  @Injectable()
  class MixinInterceptor implements NestInterceptor {
    private logger = new Logger('EnhanceFileInterceptor');

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
      }, null, 2)}`);

      try {
        await new interceptor().intercept(context, next);

        const request = context.switchToHttp().getRequest();
        if (fileInterceptor.name === 'NestedFilesInterceptor' && !localOptions.asyncSaveFiles) {
          this.generateFileNameIfNotExist(context, localOptions.dest);
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
        }

        throw error;
      }
    }

    private getInterceptorAndFieldNames(
      field: EnhanceMulterOptions['field'],
      localOptions: MulterOptions,
    ) {
      const result: {
        interceptor: Type<NestInterceptor>,
        fieldname: string | null
      } = {
        fieldname: null
      } as never;

      if (fileInterceptor.name === 'FileInterceptor') {
        result.fieldname = field as string;
        result.interceptor = (fileInterceptor as typeof FileInterceptor)(
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
        result.fieldname = name;
        result.interceptor = (fileInterceptor as typeof FilesInterceptor)(
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
        const fields: Record<string, EnhanceMulterOptions<typeof FileFieldsInterceptor>['field'][0]> = {} as never;
        (field as EnhanceMulterOptions<typeof FileFieldsInterceptor>['field'])
          .forEach(f => fields[f.name] = f);
        result.interceptor = (fileInterceptor as typeof FileFieldsInterceptor)(
          field as MulterField[],
          {
            ...localOptions,
            fileFilter: (
              req: Request,
              file: Express.Multer.File,
              callback: (error: (Error | null), acceptFile: boolean) => void,
            ) => {
              if (fields[file.fieldname]?.fileTypes) {
                file.fileTypes = fields[file.fieldname].fileTypes;
              }

              if (localOptions.fileFilter) {
                localOptions.fileFilter(req, file, callback);
              } else {
                callback(null, true);
              }
            },
            limits: {
              ...localOptions.limits,
              //? files: what?
            },
          },
        );
      } else {
        result.interceptor = fileInterceptor(options as never);
      }

      return result;
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
                file.destination = (dest as string).replace(/\//g, '\\');
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
