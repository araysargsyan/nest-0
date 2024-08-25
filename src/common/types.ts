export interface IUniquesMetadata {
  status: null | 'pending' | boolean,
  method?: string
}

export interface IUploadTypeValidatorOptions {
  fileType: string[];
}
