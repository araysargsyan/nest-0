import {
  HttpStatus,
  Injectable,
  ParseFilePipe,
  ParseFilePipeBuilder,
  PipeTransform,
} from '@nestjs/common';
import { isArray, isObject } from 'class-validator';
import { FileValidationPipeAM, IFileValidationPipeOptions } from './types';
import { UploadFileTypeValidator } from '~validator/upload-file.validator';
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
    value: Express.Multer.File | Express.Multer.File[] | Record<string, Express.Multer.File[]> | undefined,
    metadata: FileValidationPipeAM,
  ) {
    this.logger.debug(`Start... \n ${JSON.stringify({
      fileIsRequired: this.fileIsRequired,
      fileType: this.fileType, 
    }, null, 2)}`);
    let pipe: ParseFilePipe;

    if (metadata.type === 'custom') {
      const filesCount = metadata.metatype.filesCount;
      this.logger.info({
        isMulti: isArray(metadata.metatype.fieldname),
        filesCount,
        value,
        metadata
      });

      if (
        (!value
          || (isArray(value) && !value.length)
          || (isObject(value) && !Object.keys(value).length)
        ) && this.fileIsRequired
      ) {
        this.logger.infoMessage('EmptyFiles');
        pipe = this.generatePipe(HttpStatus.BAD_REQUEST, filesCount);
      } else {
        this.logger.infoMessage('ExistFiles')
        pipe = this.generatePipe(HttpStatus.UNPROCESSABLE_ENTITY, filesCount);
      }

      if(isArray(metadata.metatype.fieldname)) {
        return Promise.all(metadata.metatype.fieldname.map((key) => {
          if((isArray(this.fileIsRequired) && this.fileIsRequired.includes(key)) || value[key]) {
            this.logger.infoMessage(`Multi scenario: [${key}] start...`)
            return pipe.transform(value?.[key])
              .then((data) => ({[key]: data}))
              .catch(this.createError(key))
          }

          return value
        })).then((data) => {
          let files = {}
          data.forEach((value) => {
            files = {...files, ...value}
          })

          return files;
        })
      } else {
        this.logger.infoMessage(`Array or one scenario: [${metadata.metatype.fieldname}] start...`)
        return pipe.transform(value).catch(this.createError(metadata.metatype.fieldname))
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
    }
  }

  private generatePipe(errorHttpStatusCode: ErrorHttpStatusCode, filesCount?: number): ParseFilePipe {
    const additionalOptions: Omit<ParseFileOptions, 'validators'> = {
      errorHttpStatusCode,
      fileIsRequired: Boolean(this.fileIsRequired),
    };

    if (this.fileType) {
      return this.parseFilePipe
        .addValidator(
          new UploadFileTypeValidator({ fileType: this.fileType, filesCount }),
        )
        .build(additionalOptions);
    }

    return this.parseFilePipe.build(additionalOptions);
  }
}
