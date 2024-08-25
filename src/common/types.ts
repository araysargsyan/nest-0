export type TUniqueKeys = Record<string, null | 'pending' | boolean>
export type TUniqueMethods = Record<string, string>

export interface IUploadTypeValidatorOptions {
  fileType: string[];
}
