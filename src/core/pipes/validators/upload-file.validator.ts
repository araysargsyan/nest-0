import { FileValidator } from '@nestjs/common';
import { promises } from 'fs';
import { Logger } from '~logger/Logger';
// import * as fileType from 'file-type-mime';

import { IUploadTypeValidatorOptions } from '~types';


export class UploadFileTypeValidator extends FileValidator {
  private readonly logger = new Logger('UploadFileTypeValidator');
  // public readonly isValid: FileValidator['isValid'];

  constructor(
    protected readonly validationOptions: IUploadTypeValidatorOptions = { fileType: [] },
    // protected readonly hasErrorBefore: boolean = false,
  ) {
    super(validationOptions);
    // this.isValid = (file?: Express.Multer.File) => {
    //   return this.isValidFile(file, hasErrorBefore);
    // };
  }

  public async isValid(file: Express.Multer.File/*, hasErrorBefore: boolean*/): Promise<boolean> {
    this.logger.debug('Start checking...');
    // console.log(file, this.validationOptions);
    const isFileUploaded = Boolean(file.path);
    const data = isFileUploaded ? await promises.readFile(file.path) : file.buffer;
    // const response =await FileType.fromBuffer(data);
    const response = await import('file-type')
      .then((FileType) => FileType.fileTypeFromBuffer(data));
    const hasError = !response || !this.validationOptions.fileType.includes(response.mime) /*|| hasErrorBefore*/;

    this.logger.infoMessage('Finish checking.');
    this.logger.info({
      // hasErrorBefore,
      hasError,
      file,
      response,
      isFileUploaded,
      // stopUploading: this.stopUploading,
    });

    if (!hasError) {
      file.ext = response.ext;
    }

    return !hasError;
  }

  public buildErrorMessage(file: Express.Multer.File): string {
    return `[fieldname: ${file.fieldname}] Upload only files of type: ${this.validationOptions.fileType.join(', ')}`;
  }
}
