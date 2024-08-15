import { FileValidator, Logger } from '@nestjs/common';
import * as fileType from 'file-type-mime';
import { promises, rename, unlink } from 'fs';

async function wait(seconds: number): Promise<void> {
  try {
    return await new Promise<void>((resolve) => {
      console.log('waiting...........................', seconds);
      setTimeout(resolve, seconds);
    });
  } finally {
    console.log('after waiting...........................', seconds);
  }
}

interface IUploadTypeValidatorOptions {
  fileType: string[];
  filesCount?: number;
}

export class UploadFileTypeValidator extends FileValidator {
  private readonly logger = new Logger('UploadFileTypeValidator');
  private uploadedFilesPaths: string[] = [];
  private stopUploading: boolean = false;
  private checkedFilesCount: number = 0;
  private promises = [];

  constructor(
    protected readonly validationOptions: IUploadTypeValidatorOptions = { fileType: [] },
  ) {
    super(validationOptions);
  }

  public async isValid(file?: Express.Multer.File): Promise<boolean> {
    this.logger.debug('Start checking...')
    const isFileUploaded = Boolean(file.path);
    const data = isFileUploaded ? await promises.readFile(file.path) : file.buffer;
    const response = fileType.parse(data);
    const hasError = !response || !this.validationOptions.fileType.includes(response.mime);
    this.validationOptions.filesCount && this.checkedFilesCount++;

    this.logger.verbose('Finish checking.')
    console.log('UploadFileTypeValidator: INFO', {
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
                this.logger.debug(`Rename file ${oldPath} to ${filePath}`);
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
    this.logger.verbose('cleanUp......');
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
        this.logger.debug(`Remove file ${path}`);
      } else {
        this.logger.error('Remove file', err);
      }
    });
  }

  public buildErrorMessage(file: Express.Multer.File): string {
    return `Upload only files of type: ${this.validationOptions.fileType.join(', ')}`;
  }
}
