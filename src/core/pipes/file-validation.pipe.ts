import {
  HttpStatus,
  Inject,
  Injectable,
  mixin,
  ParseFilePipe,
  ParseFilePipeBuilder,
  PipeTransform,
} from '@nestjs/common';
import { isArray, isObject } from 'class-validator';
import { IFileValidationPipeAM, IFileValidationPipeOptions, TValue } from './types';
import { UploadFileTypeValidator } from './validators/upload-file.validator';
import { ErrorHttpStatusCode } from '@nestjs/common/utils/http-error-by-code.util';
import { ParseFileOptions } from '@nestjs/common/pipes/file/parse-file-options.interface';
import { Logger } from '~logger/Logger';
import { REQUEST } from '@nestjs/core';
import { Request } from 'express';
import { unlink, rename } from 'fs';

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
      metadata: IFileValidationPipeAM,
    ) {
      this.logger.debug(`Start... \n ${JSON.stringify({
        fileIsRequired: this.fileIsRequired,
        fileType: this.fileType,
      }, null, 2)}`);
      let pipe: ParseFilePipe;

      if (metadata.type === 'custom') {
        const isMulti = metadata.metatype.isMulti || this.isMulti(value);
        const missingRequiredField = this.getMissingRequiredField(value, isMulti, metadata.metatype);

        this.logger.info({
          missingRequiredField,
          isMulti,
          value,
          metadata,
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
                Promise.all(Object.values(value)
                  .flat(Infinity)
                  .map(val => this.removeFile(val.path)),
                );
              }
            });
        }

        if (isMulti) {
          let hasError = false;
          let checkedChunksCount = 0

          return Promise.all(Object.keys(value).map((key) => {
            this.logger.infoMessage(`[MULTI SCENARIO]: START... {key=${key}}`);

            return pipe.transform(value?.[key]).then((data) => {
              this.logger.infoMessage(`[MULTI SCENARIO]: SUCCESS ${JSON.stringify({ 
                key, data 
              }, null, 2)}`);
              return { [key]: data };
            }).catch((error) => {
              this.logger.warn(`[MULTI SCENARIO]: ERROR {key=${key}}`);
              if (!hasError) {
                hasError = true;
              }

              return this.createError(key)(error);
            }).finally(() => {
              checkedChunksCount++
              if (checkedChunksCount === Object.keys(value).length) {
                this.logger.infoMessage(`[MULTI SCENARIO]: FINISH. {hasError=${hasError}, key=${key}}`);
                if (hasError || Boolean(this.request.body._errored)) {
                  Promise.all(Object.values(value)
                    .flat(Infinity)
                    .map(val => this.removeFile(val.path)),
                  );
                } else {
                  Promise.all(Object.values(value)
                    .flat(Infinity)
                    .map(val => this.renameFile(
                      val.path,
                      `${val.path}.${val.ext}`,
                    )),
                  );
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

        this.logger.infoMessage(`Array or one scenario: [${metadata.metatype.fieldname}] start...`);
        let hasError = false;
        return pipe.transform(value)
          .catch((error) => {
            hasError = true;
            return this.createError(metadata.metatype.fieldname)(error);
          })
          .finally(() => {
            if (hasError || Boolean(this.request.body._errored)) {
              if (isArray(value)) {
                Promise.all(value.map(val => this.removeFile(val.path)));
              } else {
                this.removeFile((value as Express.Multer.File).path);
              }
            } else {
              if (isArray(value)) {
                Promise.all(value.map(val => this.renameFile(
                  val.path,
                  `${val.path}.${val.ext}`,
                )));
              } else {
                this.renameFile((value as Express.Multer.File).path, `${value.path}.${value.ext}`);
              }
            }
          });
      }
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
          [erroredFieldname || fieldname || 'files']: [
            errorResponseMessage,
          ],
        };
        error.message = errorMessage;

        throw error;
      };
    }

    //! returning null when all required fields are exists
    public getMissingRequiredField(value: TValue, isMulti: boolean, metatype: IFileValidationPipeAM['metatype']) {
      if (this.fileIsRequired) {
        const isNotEmptyValue = (!value
          || (isArray(value) && !value.length)
          || (isObject(value) && !Object.keys(value).length)
        );
        if (isNotEmptyValue) {
          return isArray(this.fileIsRequired) ? this.fileIsRequired[0] : (metatype.fieldname || '');
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


