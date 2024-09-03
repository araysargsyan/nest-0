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
import { IFileValidationPipeOptions, TFileValidationPipeValue } from './types';
import { UploadFileTypeValidator } from './validators/upload-file.validator';
import { ErrorHttpStatusCode } from '@nestjs/common/utils/http-error-by-code.util';
import { ParseFileOptions } from '@nestjs/common/pipes/file/parse-file-options.interface';
import { Logger } from '~logger/Logger';
import { REQUEST } from '@nestjs/core';
import { Request } from 'express';
import { unlink, rename, mkdir, writeFile } from 'fs';
import { BODY_ERRORED, FILE_METADATA } from '~constants/core.const';
import { dirname } from 'path';


export const FileValidationPipe = (
  {
    fileTypes = null,
    fileIsRequired = true,
  }: IFileValidationPipeOptions,
) => {
  @Injectable()
  class Pipe implements PipeTransform {
    public logger = new Logger('FileValidationPipe');
    public readonly fileIsRequired: IFileValidationPipeOptions['fileIsRequired'];
    public readonly fileTypes: IFileValidationPipeOptions['fileTypes'];
    public readonly parseFilePipe: ParseFilePipeBuilder = new ParseFilePipeBuilder();


    constructor(
      @Inject(REQUEST) readonly request: Request,
    ) {
      this.fileIsRequired = fileIsRequired;
      this.fileTypes = fileTypes;
    }

    async transform(
      value: TFileValidationPipeValue,
      metadata: ArgumentMetadata,
    ) {
      let pipe: ParseFilePipe;

      if (metadata.type === 'custom') {
        const isRequired = isArray(this.fileIsRequired) ? Boolean(this.fileIsRequired.length) : this.fileIsRequired;
        const fileMetadata: undefined | {
          isMulti?: boolean;
          fieldname?: string;
        } = Reflect.getMetadata(FILE_METADATA, this.request.route);
        Reflect.defineMetadata(FILE_METADATA, fileMetadata, metadata.metatype);
        this.logger.debug(`Start... \n ${JSON.stringify({
          fileIsRequired,
          isRequired,
          fileTypes,
          fileMetadata,
        }, null, 2)}`);

        if (!isRequired && !value) {
          return value;
        }
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
          pipe = this.generatePipe(HttpStatus.BAD_REQUEST, isRequired);

        } else {
          this.logger.infoMessage('ExistFiles');
          pipe = this.generatePipe(HttpStatus.UNPROCESSABLE_ENTITY, isRequired);
        }

        if (missingRequiredField !== null) {
          this.logger.infoMessage(`Missing required scenario: [${missingRequiredField}] start...`);
          return pipe.transform(undefined)
            .catch(this.createError(missingRequiredField))
            .finally(() => {
              if (isMulti) {
                this.checkBodyError(metadata.metatype);
                value && this.removeFiles(Object.values(value).flat(Infinity));
              }
            });
        }

        if (isMulti) {
          let hasError = false;

          return Promise.all(Object.keys(value).map(async (key) => {
            try {
              const data = await pipe.transform(value?.[key]);
              this.logger.infoMessage(`[MULTI SCENARIO]: SUCCESS ${JSON.stringify({
                key, data,
              }, null, 2)}`);
              return { [key]: data };
            } catch (error) {
              this.logger.warn(`[MULTI SCENARIO]: ERROR {key=${key}}`);
              return this.createError(key)(error);
            }
          })).then((data) => {
            this.logger.infoMessage('[MULTI SCENARIO]: PROMISE ALL RESOLVE');
            let files = {};
            data.forEach((value) => {
              files = { ...files, ...value };
            });

            return files;
          }).catch((err) => {
            this.logger.warn('[MULTI SCENARIO]: PROMISE ALL REJECT');
            if (!hasError) {
              hasError = true;
            }
            throw err;
          }).finally(() => {
            this.logger.infoMessage(`[MULTI SCENARIO]: FINISH. {hasError=${hasError}`);
            const isBodyErrored = this.checkBodyError(metadata.metatype);
            if (hasError || isBodyErrored) {
              this.removeFiles(Object.values(value).flat(Infinity));
            } else {
              this.renameOrCrateFiles(Object.values(value).flat(Infinity));
            }
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
              this.renameOrCrateFiles(value);
            } else {
              this.renameOrCrateFiles(value as Express.Multer.File);
            }
          }
        });
      }
    }

    public renameOrCrateFiles(files: Express.Multer.File | Express.Multer.File[]) {
      Reflect.deleteMetadata(FILE_METADATA, this.request.route);
      if (isArray(files)) {
        const promises = files.map(file => {
          if (file.destination && file.buffer) {
            const buffer = file.buffer;
            delete file.buffer;
            file.path = `${file.destination}\\${file.filename}.${file.ext}`;

            return this.createFile(
              file.path,
              buffer,
            );
          }

          if (!file.path) {
            return;
          }

          const oldPath = file.path;
          const newPath = `${oldPath}.${file.ext}`;
          file.path = newPath;
          return this.renameFile(oldPath, newPath);
        });

        return Promise.all(promises);
      }
      if (files.path) {
        const oldPath = files.path;
        const newPath = `${oldPath}.${files.ext}`;
        files.path = newPath;
        return this.renameFile(oldPath, newPath);
      }
    }

    public removeFiles(files: Express.Multer.File | Express.Multer.File[]) {
      Reflect.deleteMetadata(FILE_METADATA, this.request.route);
      if (isArray(files)) {
        return Promise.all(files.map(file => file.path ?
          this.removeFile(file.path)
          : false,
        ));
      }

      return this.removeFile(files.path);
    }

    public checkBodyError(metatype: ArgumentMetadata['metatype']) {
      const isBodyErrored = Boolean(Reflect.getMetadata(BODY_ERRORED, metatype));
      this.logger.infoMessage(`isBodyErrored=${isBodyErrored}`);
      if (isBodyErrored) {
        Reflect.deleteMetadata(BODY_ERRORED, metatype);
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

    public createFile(path: string, data: string | Buffer): Promise<string> {
      return new Promise((resolve, reject) => {
        mkdir(dirname(path), { recursive: true }, (mkdirErr) => {
          if (mkdirErr) {
            this.logger.error('Create directory', mkdirErr);
            return reject(mkdirErr);
          }

          writeFile(path, data, (writeErr) => {
            if (writeErr) {
              this.logger.error('Create file', writeErr);
              return reject(writeErr);
            }

            this.logger.verbose(`File created at ${path}`);
            resolve(path);
          });
        });
      });
    }

    public isMulti(value: TFileValidationPipeValue) {
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

    public createError(defaultFieldname?: string) {
      return (error) => {
        this.logger.error(`CATCHING ERROR ${JSON.stringify({ defaultFieldname }, null, 2)}`);
        let erroredFieldname = defaultFieldname;
        let errorResponseMessage = error.message;
        const regex = /\[\s*fieldname\s*:\s*(.*)\s*]/;
        const match = regex.exec(error.message);
        if (match) {
          errorResponseMessage = errorResponseMessage.split(match[0])[1].trim();
          erroredFieldname = match[1].trim();
        }

        const errorResponse = {
          [erroredFieldname]: [
            errorResponseMessage,
          ],
        };

        const errorMessage = error.response?.error;
        error.response = errorResponse;
        error.message = errorMessage;

        throw error;
      };
    }

    //! returning null when all required fields are exists
    public getMissingRequiredField(
      value: TFileValidationPipeValue,
      isMulti: boolean,
      fieldname: string | undefined,
    ) {
      if (this.fileIsRequired) {
        const isEmptyValue = (!value
          || (isArray(value) && !value.length)
          || (isObject(value) && !Object.keys(value).length)
        );

        if (isEmptyValue) {
          return isArray(this.fileIsRequired) ? this.fileIsRequired[0] || null : fieldname;
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

    public generatePipe(errorHttpStatusCode: ErrorHttpStatusCode, fileIsRequired: boolean): ParseFilePipe {
      const additionalOptions: Omit<ParseFileOptions, 'validators'> = {
        errorHttpStatusCode,
        fileIsRequired,
      };

      const validator = new UploadFileTypeValidator(
        { fileTypes: this.fileTypes },
      );

      return this.parseFilePipe
        .addValidator(validator)
        .build(additionalOptions);

    }
  }

  return mixin(Pipe);
};
