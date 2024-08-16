import { HttpStatus, Injectable, ParseFilePipe, ParseFilePipeBuilder, PipeTransform } from '@nestjs/common';
import { isArray, isObject } from 'class-validator';
import { FileValidationPipeAM, IFileValidationPipeOptions, TValue } from './types';
import { UploadFileTypeValidator } from './validators/upload-file.validator';
import { ErrorHttpStatusCode } from '@nestjs/common/utils/http-error-by-code.util';
import { ParseFileOptions } from '@nestjs/common/pipes/file/parse-file-options.interface';
import { Logger } from '~logger/Logger';


@Injectable()
export class FileValidationPipe implements PipeTransform {
  private logger = new Logger('FileValidationPipe');
  private readonly fileIsRequired: IFileValidationPipeOptions['fileIsRequired'];
  private readonly fileType: IFileValidationPipeOptions['fileType'];
  private readonly parseFilePipe: ParseFilePipeBuilder = new ParseFilePipeBuilder();

  constructor(
    { fileType = null, fileIsRequired = true }: IFileValidationPipeOptions,
  ) {
    this.fileIsRequired = fileIsRequired;
    this.fileType = fileType;
  }

  async transform(
    value: TValue,
    metadata: FileValidationPipeAM,
  ) {
    this.logger.debug(`Start... \n ${JSON.stringify({
      fileIsRequired: this.fileIsRequired,
      fileType: this.fileType,
    }, null, 2)}`);
    let pipe: ParseFilePipe;

    if (metadata.type === 'custom') {
      const filesCount = metadata.metatype.filesCount;
      const isMulti = isArray(metadata.metatype.fieldname);
      this.logger.info({
        isMulti,
        filesCount,
        value,
        metadata,
      });

      if (!this.checkIfRequiredFieldExist(value, isMulti) && this.fileIsRequired) {
        this.logger.infoMessage('EmptyFiles');
        pipe = this.generatePipe(HttpStatus.BAD_REQUEST, filesCount);
      } else {
        this.logger.infoMessage('ExistFiles');
        pipe = this.generatePipe(HttpStatus.UNPROCESSABLE_ENTITY, filesCount);
      }

      if (isMulti) {
        return Promise.all((metadata.metatype.fieldname as string[]).map((key) => {
          if ((isArray(this.fileIsRequired)
              ? this.fileIsRequired.includes(key)
              : this.fileIsRequired
          ) || value[key]) {
            this.logger.infoMessage(`Multi scenario: [${key}] start...`);
            return pipe.transform(value?.[key])
              .then((data) => ({ [key]: data }))
              .catch(this.createError(key));
          }

          return value;
        })).then((data) => {
          let files = {};
          data.forEach((value) => {
            files = { ...files, ...value };
          });

          return files;
        });
      } else {
        this.logger.infoMessage(`Array or one scenario: [${metadata.metatype.fieldname}] start...`);
        return pipe.transform(value).catch(this.createError(metadata.metatype.fieldname));
      }
    }
  }

  private createError(fieldname) {
    return (error) => {
      // console.log('FileValidationPipe: createError', error);
      const errorMessage = error.response?.error;
      error.response = {
        [fieldname]: [
          error.message,
        ],
      };
      error.message = errorMessage;

      throw error;
    };
  }

  private checkIfRequiredFieldExist(value: TValue, isMulti: boolean) {
    if ((!value
      || (isArray(value) && !value.length)
      || (isObject(value) && !Object.keys(value).length)
    )) {
      return false;
    }

    if (isMulti && isArray(this.fileIsRequired)) {
      for (const key of this.fileIsRequired) {
        if (!value[key]) {
          return false;
        }
      }
    }

    return true;
  }

  private generatePipe(errorHttpStatusCode: ErrorHttpStatusCode, filesCount?: number): ParseFilePipe {
    const additionalOptions: Omit<ParseFileOptions, 'validators'> = {
      errorHttpStatusCode,
      fileIsRequired: Boolean(this.fileIsRequired),
    };

    if (this.fileType) {
      return this.parseFilePipe
        .addValidator(
          new UploadFileTypeValidator(
            { fileType: this.fileType, filesCount },
            errorHttpStatusCode === HttpStatus.BAD_REQUEST,
          ),
        )
        .build(additionalOptions);
    }

    return this.parseFilePipe.build(additionalOptions);
  }
}
