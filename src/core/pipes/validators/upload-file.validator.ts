import { FileValidator } from '@nestjs/common';
import { promises } from 'fs';
import { Logger } from '~logger/Logger';
// import * as fileType from 'file-type-mime';
import { isUndefined } from '@nestjs/common/utils/shared.utils';
import { TUploadTypeValidatorOptions } from '../types';


export class UploadFileTypeValidator extends FileValidator {
  private readonly logger = new Logger('UploadFileTypeValidator');

  constructor(
    protected readonly validationOptions: TUploadTypeValidatorOptions = { fileTypes: [] },
  ) {
    super(validationOptions);
  }

  public async isValid(file: Express.Multer.File): Promise<boolean> {
    this.logger.debug('Start checking...');
    const fileTypes = this.getFileTypes(file)
    if(fileTypes) {
      const isFileUploaded = Boolean(file.path);
      const buffer = isFileUploaded ? await promises.readFile(file.path) : file.buffer;
      // const response =await FileType.fromBuffer(data);
      const response = await import('file-type')
        .then((FileType) => FileType.fileTypeFromBuffer(buffer));
      const hasError = !response
        || file.mimetype !== response.mime
        || !fileTypes.includes(response.mime);

      if (isUndefined(response)) {
        this.logger.warn(`FILE [${file.originalname}] WAS BROKEN OR NOT SPURTED FOR VALIDATION`);
      }

      this.logger.infoMessage('Finish checking.');
      this.logger.info({
        fileTypes,
        hasError,
        file,
        response,
        isFileUploaded,
      });

      if (!hasError) {
        file.ext = response.ext;
        delete file.fileTypes
      }

      return !hasError;
    }

    return true
  }

  private getFileTypes(file: Express.Multer.File) {
    return file.fileTypes || this.validationOptions.fileTypes
  }

  public buildErrorMessage(file: Express.Multer.File): string {
    return `[fieldname: ${file.fieldname}] Upload only files of type: ${this.getFileTypes(file).join(', ')}`;
  }
}
