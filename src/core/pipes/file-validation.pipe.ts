import {
  ArgumentMetadata,
  HttpStatus,
  Injectable, Logger,
  ParseFilePipe,
  ParseFilePipeBuilder,
  PipeTransform,
} from '@nestjs/common';
import { isArray } from 'class-validator';
import { FIELD_NAME_FROM_REQ, IFileValidationPipeOptions, PARSE_JSON } from './types';
import { UploadFileTypeValidator } from '~validator/upload-file.validator';
import { ErrorHttpStatusCode } from '@nestjs/common/utils/http-error-by-code.util';

@Injectable()
export class FileValidationPipe implements PipeTransform {
  private logger = new Logger('FileValidationPipe')
  private readonly fileIsRequired: boolean;
  private readonly fileType: string[];
  private readonly parseFilePipe: ParseFilePipeBuilder = new ParseFilePipeBuilder();

  constructor(
    { fileType = null, fileIsRequired = true }: IFileValidationPipeOptions,
  ) {
    this.fileIsRequired = fileIsRequired;
    this.fileType = fileType;
  }

  async transform(
    value: Express.Multer.File | Express.Multer.File[] | undefined,
    metadata: ArgumentMetadata
  ) {
    let pipe: ParseFilePipe
    this.logger.debug(JSON.stringify({value, metadata}, null, 2));

    if (metadata.type === 'custom') {
      if ((!value || (isArray(value) && !value.length)) && this.fileIsRequired) {
        pipe = this.generatePipe(HttpStatus.BAD_REQUEST)
      } else {
        pipe = this.generatePipe(HttpStatus.UNPROCESSABLE_ENTITY)
      }

      //! adding filesCount in files (it needed for FileTypeValidator)
      if (isArray(value)) {
        value.forEach(v => v.filesCount = value.length);
      }
    }

    return pipe.transform(value).catch((error) => {
      if(!error.response?.message.includes(PARSE_JSON)) {
        const errorMessage = error.response?.error
        error.response = {
          [FIELD_NAME_FROM_REQ]: [
            error.message
          ]
        }
        error.message = errorMessage
      }

      throw error;
    });
  }

  private generatePipe(errorHttpStatusCode: ErrorHttpStatusCode): ParseFilePipe {
    if (this.fileType) {
      return this.parseFilePipe
        .addValidator(
          new UploadFileTypeValidator({ fileType: this.fileType }),
        )
        .build({
          errorHttpStatusCode,
          fileIsRequired: this.fileIsRequired,
        });
    }

    return this.parseFilePipe
      .build({
        errorHttpStatusCode,
        fileIsRequired: this.fileIsRequired,
      });
  }
}
