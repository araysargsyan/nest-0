import { Inject, Injectable, mixin, PipeTransform } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { Request } from 'express';
import { isArray } from 'class-validator';

export function MargeFilesToBodyPipe(includingKeys: string | string[] = '', key?: string) {
  @Injectable()
  class Pipe implements PipeTransform {
    // private logger = new Logger('FileValidationPipe');

    constructor(
      @Inject(REQUEST) readonly request: Request
    ) {}

    async transform(
      value: any,
      metadata: any,
    ) {
      console.log('MargeFilesToBodyPipe$$', {
        value,
        metadata,
        body: this.request.body,
        files: this.request.files,
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
        [value.constructor.fieldname || key || 'files']: files
      }
    }

  }

  return mixin(Pipe)
}


