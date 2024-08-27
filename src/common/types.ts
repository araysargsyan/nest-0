import { MulterField } from '@nestjs/platform-express/multer/interfaces/multer-options.interface';

interface IUniquesMetadata {
  status: null | 'pending' | boolean,
  method?: string
}

type TMulterFieldWithoutNesting = {
  name: string
  required?: boolean,
  maxCount?: number,

  length?: never,
  nestedField?: never
  key?: never
}
type TNestedMulterField = {
  nestedField: TNestedMulterField | TMulterFieldWithoutNesting
  key: string,
  length?: number,

  maxCount?: never,
  name?: never
  required?: never,
} | TMulterFieldWithoutNesting

export {
  IUniquesMetadata,
  TNestedMulterField,
}
