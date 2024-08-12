import { FileValidator, Logger } from '@nestjs/common';
import * as fileType from 'file-type-mime';
import { promises, rename, unlink } from 'fs';


export interface CustomUploadTypeValidatorOptions {
  fileType: string[];
}

export class UploadFileTypeValidator extends FileValidator {
  private readonly logger = new Logger('UploadFileTypeValidator')
  private uploadedFilesPaths: string[] = [];
  private stopUploading: boolean = false;
  private checkedFilesCount: number = 0;

  constructor(
    protected readonly validationOptions: CustomUploadTypeValidatorOptions = {fileType: []},
  ) {
    super(validationOptions);
  }

  public async isValid(file?: Express.Multer.File): Promise<boolean> {
    const isFileUploaded = Boolean(file.path)
    const data = isFileUploaded ? await promises.readFile(file.path) : file.buffer;
    const response = fileType.parse(data);
    const hasError = !response || !this.validationOptions.fileType.includes(response.mime)
    file.filesCount && this.checkedFilesCount++

    // console.log('UploadFileTypeValidator', {
    //   file,
    //   hasError,
    //   response,
    //   isFileUploaded,
    //   uploadedFilesPaths: this.uploadedFilesPaths,
    //   stopUploading: this.stopUploading,
    //   checkedFilesCount: this.checkedFilesCount
    // });

    if(hasError || this.stopUploading) {
      if (file.filesCount) {
        this.stopUploading = true
      }

      if(isFileUploaded) {
        this.removeFile(file.path)
        this.uploadedFilesPaths.forEach((path) => this.removeFile(path))
      }
    } else {
      if (isFileUploaded) {
        const filePath = `${file.path}.${response.ext}`

        file.filesCount && this.uploadedFilesPaths.push(filePath)
        rename(file.path, filePath, (err) => {
          if (!err) {
            this.logger.debug(`Rename file ${filePath}`);
          } else {
            this.logger.error('Rename file', err);
          }
        })
        file.path = filePath
      } else {
        file.filesCount && this.uploadedFilesPaths.push(file.originalname)
      }

    }

    if(this.checkedFilesCount === file.filesCount) {
      this.checkedFilesCount = 0
      this.uploadedFilesPaths = []
      this.stopUploading = false
    }

   return !hasError;
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
    const error = {
      PARSE_JSON: null,
      [file.fieldname]: [
        `Upload only files of type: ${this.validationOptions.fileType.join(', ')}`
      ]
    }

    return JSON.stringify(error);
  }
}
