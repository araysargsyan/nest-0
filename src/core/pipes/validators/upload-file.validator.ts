import { FileValidator } from '@nestjs/common';
import { promises, rename, unlink } from 'fs';
import { Logger } from '~logger/Logger';
// import * as fileType from 'file-type-mime';

import { IUploadTypeValidatorOptions } from '~types';


export class UploadFileTypeValidator extends FileValidator {
  private readonly logger = new Logger('UploadFileTypeValidator');
  private uploadedFilesPaths: string[] = [];
  private stopUploading: boolean = false;
  private checkedFilesCount: number = 0;
  private promises = [];
  public readonly isValid: FileValidator['isValid']

  constructor(
    protected readonly validationOptions: IUploadTypeValidatorOptions = { fileType: [] },
    protected readonly hasFieldNames: boolean,
    protected readonly hasError: boolean = false,
  ) {
    super(validationOptions)
    this.isValid = (file?: Express.Multer.File) => {
      return this.isValidFile(file, hasError)
    }
  }

  public async isValidFile(file: Express.Multer.File, hasErrorBefore: boolean): Promise<boolean> {
    this.logger.debug('Start checking...')
    const isFileUploaded = Boolean(file.path);
    const data = isFileUploaded ? await promises.readFile(file.path) : file.buffer;
    // const response =await FileType.fromBuffer(data);
    const response = await import('file-type')
        .then((FileType) => FileType.fileTypeFromBuffer(data))  ;
    const hasError = !response || !this.validationOptions.fileType.includes(response.mime) || hasErrorBefore;
    this.validationOptions.filesCount && this.checkedFilesCount++;

    this.logger.infoMessage('Finish checking.')
    this.logger.info( {
      hasError,
      file,
      response,
      isFileUploaded,
      uploadedFilesPaths: this.uploadedFilesPaths,
      stopUploading: this.stopUploading,
      checkedFilesCount: this.checkedFilesCount,
    });

    if (hasError || this.stopUploading) {
      if (this.validationOptions.filesCount) {
        this.stopUploading = true;
        this.promises = [];
      }

      if (isFileUploaded) {
        this.removeFile(file.path);
        this.uploadedFilesPaths.forEach((path, index) => {
          this.removeFile(path)
          if (index === this.uploadedFilesPaths.length - 1) {
            this.uploadedFilesPaths = []
          }
        });
      }
    } else {
      if (isFileUploaded) {
        const filePath = `${file.path}.${response.ext}`;
        const oldPath = file.path;
        this.validationOptions.filesCount && this.uploadedFilesPaths.push(oldPath);
        file.path = filePath;

        this.promises.push(
          () => {
            rename(oldPath, filePath, (err) => {
              if (!err) {
                this.logger.verbose(`Rename file ${oldPath} to ${filePath}`);
              } else {
                this.logger.error('Rename file', err);
              }
            });
          },
        );
      } else {
        //??????????????
        this.validationOptions.filesCount && this.uploadedFilesPaths.push(file.originalname);
      }

    }

    if (this.checkedFilesCount === this.validationOptions.filesCount
      || this.validationOptions.filesCount === undefined
    ) {
      this.cleanUp()
    }

    return !hasError;

  }

  private cleanUp() {
    this.logger.infoMessage('cleanUp......');
    this.promises.forEach((cb, index) => {
      cb();
      if (index === this.promises.length - 1) {
        this.promises = [];
      }
    });
    this.checkedFilesCount = 0;
    this.uploadedFilesPaths = [];
    this.stopUploading = false;
  }

  private removeFile(path: string) {
    unlink(path, (err) => {
      if (!err) {
        this.logger.verbose(`Remove file ${path}`);
      } else {
        this.logger.error('Remove file', err);
      }
    });
  }

  public buildErrorMessage(file: Express.Multer.File): string {
    if(!this.hasFieldNames) {
      return `[fieldname: ${file.fieldname}] Upload only files of type: ${this.validationOptions.fileType.join(', ')}`
    }
    return `Upload only files of type: ${this.validationOptions.fileType.join(', ')}`;

  }
}
