import { CallHandler, ExecutionContext, Injectable, Logger, mixin, NestInterceptor, Type } from '@nestjs/common';
import { Observable } from 'rxjs';
import { v4 as uuidv4 } from 'uuid';
import { FIELD_NAME_FROM_REQ } from '@core/pipes/types';

export function FileMixInterceptor(fileInterceptor: () => Type<NestInterceptor>): Type<NestInterceptor> {
  @Injectable()
  class MixinInterceptor implements NestInterceptor {
    async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<any>> {
      const regex = /\(\s*[^()]*\s*\)\s*\(\s*'([^']+)'[^,()]*\s*,/;
      const match = fileInterceptor.toString().match(regex);
      const fieldName = match ? match[1].trim() : null;
      Logger.debug(fieldName, 'FileMixInterceptor')

      try {
        await new (fileInterceptor())().intercept(context, next);
      } catch (error: any) {
        const errorMessage = error.response?.error
        error.response = {
          [fieldName || 'file']: [
            error.message
          ]
        }
        error.message = errorMessage

        throw error
      }

      const req = context.switchToHttp().getRequest()

      if(req.file && !req.file.filename) {
        req.file.filename = uuidv4();
      }
      if(req.files) {
        req.files.forEach((file: Express.Multer.File) => {
          if(!file.filename) {
            file.filename = uuidv4()
          }
        })
      }

      //! this is for isFileRequired validation
      if(!req.file || !req.files?.length) {
        req[FIELD_NAME_FROM_REQ] = fieldName
      }

      return next.handle();
    }
  }

  return mixin(MixinInterceptor);
}
