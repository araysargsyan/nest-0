import {
  ArgumentMetadata,
  HttpStatus,
  Inject,
  Injectable,
  mixin,
  ParseFilePipe,
  ParseFilePipeBuilder,
  PipeTransform,
} from '@nestjs/common';
import { isArray, isObject } from 'class-validator';
import { IFileValidationPipeOptions, TValue } from './types';
import { UploadFileTypeValidator } from './validators/upload-file.validator';
import { ErrorHttpStatusCode } from '@nestjs/common/utils/http-error-by-code.util';
import { ParseFileOptions } from '@nestjs/common/pipes/file/parse-file-options.interface';
import { Logger } from '~logger/Logger';
import { REQUEST } from '@nestjs/core';
import { Request } from 'express';
import { unlink, rename } from 'fs';
import { BODY_ERRORED, FILE_METADATA } from '~constants/core.const';


export const FileValidationPipe = ({ fileType = null, fileIsRequired = true }: IFileValidationPipeOptions) => {
  @Injectable()
  class Pipe implements PipeTransform {
    public logger = new Logger('FileValidationPipe');
    public readonly fileIsRequired: IFileValidationPipeOptions['fileIsRequired'];
    public readonly fileType: IFileValidationPipeOptions['fileType'];
    public readonly parseFilePipe: ParseFilePipeBuilder = new ParseFilePipeBuilder();


    constructor(
      @Inject(REQUEST) readonly request: Request,
    ) {
      this.fileIsRequired = fileIsRequired;
      this.fileType = fileType;
    }

    async transform(
      value: TValue,
      metadata: ArgumentMetadata,
    ) {
      const fileMetadata: undefined | {
        isMulti?: boolean;
        fieldname?: string;
      } = Reflect.getMetadata(FILE_METADATA, this.request.route)
      Reflect.defineMetadata(FILE_METADATA, fileMetadata, metadata.metatype)
      this.logger.debug(`Start... \n ${JSON.stringify({
        fileIsRequired: this.fileIsRequired,
        fileType: this.fileType,
        fileMetadata
      }, null, 2)}`);
      let pipe: ParseFilePipe;

      if (metadata.type === 'custom') {
        const isMulti = /*value?.constructor?.isMulti */ fileMetadata?.isMulti || this.isMulti(value);
        const fieldname = /*value?.constructor?.fieldname */fileMetadata?.fieldname || 'files';
        const missingRequiredField = this.getMissingRequiredField(value, isMulti, fieldname);
        this.logger.info({
          missingRequiredField,
          isMulti,
          value,
          metadata,
          fieldname,
        });

        if (missingRequiredField !== null) {
          this.logger.infoMessage('EmptyFiles');
          pipe = this.generatePipe(HttpStatus.BAD_REQUEST);
        } else {
          this.logger.infoMessage('ExistFiles');
          pipe = this.generatePipe(HttpStatus.UNPROCESSABLE_ENTITY);
        }

        if (missingRequiredField !== null) {
          this.logger.infoMessage(`Missing required scenario: [${missingRequiredField}] start...`);
          return pipe.transform(undefined)
            .catch(this.createError(missingRequiredField))
            .finally(() => {
              if (isMulti) {
                this.checkBodyError(metadata.metatype);
                this.removeFiles(Object.values(value).flat(Infinity));
              }
            });
        }

        if (isMulti) {
          let hasError = false;
          let checkedChunksCount = 0;

          return Promise.all(Object.keys(value).map((key) => {
            this.logger.infoMessage(`[MULTI SCENARIO]: START... {key=${key}}`);

            return pipe.transform(value?.[key]).then((data) => {
              this.logger.infoMessage(`[MULTI SCENARIO]: SUCCESS ${JSON.stringify({
                key, data,
              }, null, 2)}`);
              return { [key]: data };
            }).catch((error) => {
              this.logger.warn(`[MULTI SCENARIO]: ERROR {key=${key}}`);
              if (!hasError) {
                hasError = true;
              }

              return this.createError(key)(error);
            }).finally(() => {
              checkedChunksCount++;
              if (checkedChunksCount === Object.keys(value).length) {
                this.logger.infoMessage(`[MULTI SCENARIO]: FINISH. {hasError=${hasError}, key=${key}}`);
                const isBodyErrored = this.checkBodyError(metadata.metatype);
                if (hasError || isBodyErrored) {
                  this.removeFiles(Object.values(value).flat(Infinity));
                } else {
                  this.renameFiles(Object.values(value).flat(Infinity));
                }
              }
            });
          })).then((data) => {
            this.logger.infoMessage('[MULTI SCENARIO]: PROMISE ALL RESOLVE');
            let files = {};
            data.forEach((value) => {
              files = { ...files, ...value };
            });

            return files;
          }).catch((err) => {
            this.logger.warn('[MULTI SCENARIO]: PROMISE ALL REJECT');
            throw err;
          });
        }

        this.logger.infoMessage(`Array or one scenario: [${fieldname}] start...`);
        let hasError = false;
        return pipe.transform(value).catch((error) => {
          hasError = true;
          return this.createError(fieldname)(error);
        }).finally(() => {
          const isBodyErrored = this.checkBodyError(metadata.metatype);

          if (hasError || isBodyErrored) {
            if (isArray(value)) {
              this.removeFiles(value);
            } else {
              this.removeFiles(value as Express.Multer.File);
            }
          } else {
            if (isArray(value)) {
              this.renameFiles(value);
            } else {
              this.renameFiles(value as Express.Multer.File);
            }
          }
        });
      }
    }

    public renameFiles(files: Express.Multer.File | Express.Multer.File[]) {
      Reflect.deleteMetadata(FILE_METADATA, this.request.route)
      if (isArray(files)) {
        return Promise.all(files.map(file => {
          const oldPath = file.path;
          const newPath = `${oldPath}.${file.ext}`;
          file.path = newPath;
          return this.renameFile(oldPath, newPath);
        }));
      }
      const oldPath = files.path;
      const newPath = `${oldPath}.${files.ext}`;
      files.path = newPath;
      return this.renameFile(oldPath, newPath);
    }

    public removeFiles(files: Express.Multer.File | Express.Multer.File[]) {
      Reflect.deleteMetadata(FILE_METADATA, this.request.route)
      if (isArray(files)) {
        return Promise.all(files.map(file => this.removeFile(file.path)));
      }

      return this.removeFile(files.path);
    }

    public checkBodyError(metatype: ArgumentMetadata['metatype']) {
      const isBodyErrored = Boolean(Reflect.getMetadata(BODY_ERRORED, metatype));
      this.logger.infoMessage(`isBodyErrored=${isBodyErrored}`);
      if (isBodyErrored) {
        Reflect.deleteMetadata(BODY_ERRORED, metatype)
      }

      return isBodyErrored;
    }

    public removeFile(path: string) {
      if (Boolean(path)) {
        unlink(path, (err) => {
          if (!err) {
            this.logger.verbose(`Remove file ${path}`);
          } else {
            this.logger.error('Remove file', err);
          }
        });
      }
    }

    public renameFile(oldPath: string, newPath: string) {
      if (Boolean(oldPath)) {
        rename(oldPath, newPath, (err) => {
          if (!err) {
            this.logger.verbose(`Rename file ${oldPath} to ${newPath}`);
          } else {
            this.logger.error('Rename file', err);
          }
        });
      }
    }

    public isMulti(value: TValue) {
      if (isObject(value)) {
        for (const key of Object.keys(value)) {
          if (isArray(value[key])) {
            return true;
          }
        }
      } else if (isArray(this.fileIsRequired) && !value) {
        return true;
      }

      return false;
    }

    public createError(fieldname?: string) {
      return (error) => {
        this.logger.error(`CATCHING ERROR ${JSON.stringify({ fieldname }, null, 2)}`);
        let erroredFieldname = '';
        let errorResponseMessage = error.message;
        const regex = /\[\s*fieldname\s*:\s*(.*)\s*]/;
        const match = regex.exec(error.message);
        if (match) {
          errorResponseMessage = errorResponseMessage.split(match[0])[1].trim();
          erroredFieldname = match[1].trim();
        }
        const errorMessage = error.response?.error;
        error.response = {
          [erroredFieldname || fieldname]: [
            errorResponseMessage,
          ],
        };
        error.message = errorMessage;

        throw error;
      };
    }

    //! returning null when all required fields are exists
    public getMissingRequiredField(value: TValue, isMulti: boolean, fieldname: string | undefined) {
      if (this.fileIsRequired) {
        const isNotEmptyValue = (!value
          || (isArray(value) && !value.length)
          || (isObject(value) && !Object.keys(value).length)
        );
        if (isNotEmptyValue) {
          return isArray(this.fileIsRequired) ? this.fileIsRequired[0] : fieldname;
        }

        if (isMulti && isArray(this.fileIsRequired)) {
          for (const key of this.fileIsRequired) {
            if (!value[key]) {
              return key;
            }
          }
        }
      }

      return null;
    }

    public generatePipe(errorHttpStatusCode: ErrorHttpStatusCode): ParseFilePipe {
      const additionalOptions: Omit<ParseFileOptions, 'validators'> = {
        errorHttpStatusCode,
        fileIsRequired: Boolean(this.fileIsRequired),
      };

      if (this.fileType) {
        return this.parseFilePipe
          .addValidator(
            new UploadFileTypeValidator(
              { fileType: this.fileType },
            ),
          )
          .build(additionalOptions);
      }

      return this.parseFilePipe.build(additionalOptions);
    }
  }

  return mixin(Pipe);
};


