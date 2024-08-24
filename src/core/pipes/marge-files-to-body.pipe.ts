import { Inject, Injectable, mixin, PipeTransform } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { Request } from 'express';
import { isArray } from 'class-validator';
import { FILE_METADATA } from '~constants/core.const';
import { Logger } from '~logger/Logger';

export function MargeFilesToBodyPipe(includingKeys: string | string[] = '', key?: string) {
  @Injectable()
  class Pipe implements PipeTransform {
    public logger = new Logger('FileValidationPipe');

    constructor(
      @Inject(REQUEST) readonly request: Request
    ) {}

    async transform(
      value: any,
      metadata: any,
    ) {
      this.logger.verbose('START')
      const fileMetadata: undefined | {
        isMulti?: boolean;
        fieldname?: string;
      } = Reflect.getMetadata(FILE_METADATA, metadata.metatype)
      Reflect.deleteMetadata(FILE_METADATA, metadata.metatype)
      this.logger.info({
        value,
        metadata,
        body: this.request.body,
        fileMetadata,
        includingKeys,
        key
      });

      let files = value

      if(includingKeys) {
        if(isArray((value))) {
          files = value.map((val) => {
            if(isArray(includingKeys)) {
              const file = {}
              includingKeys.forEach((includingKey) => {
                file[includingKey] = val[includingKey];
              })

              return file
            }

            return val[includingKeys]
          })
        }
      }


      return {
        ...this.request.body,
        [fileMetadata?.fieldname || key || 'files']: files
      }
    }

  }

  return mixin(Pipe)
}


