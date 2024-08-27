import { isArray } from 'class-validator';
import { isUndefined } from '@nestjs/common/utils/shared.utils';
import { MulterField } from '@nestjs/platform-express/multer/interfaces/multer-options.interface';
import { TNestedMulterField } from '../types';

export class GenerateMultiFields<T extends boolean = false> {
  public fields: MulterField[] = []
  public fieldNames?: string[]

  constructor(
    nestedFields: TNestedMulterField[],
    private withFieldNames: T = false as T,
  ) {
    if(withFieldNames) {
      this.fieldNames = []
    }
    if (isArray(nestedFields)) {
      nestedFields.forEach((field) => this.generateNestedField(field));
    }
  }

  private generateNestedField(field: TNestedMulterField, parentKey = '') {
    const nestedFields = []

    if ('nestedField' in field) {
      if ('length' in field) {
        for (let i = 0; i < field.length; i++) {
          const keyPrefix = parentKey
            ? `${parentKey}[${field.key}][${i}]`
            : `${parentKey}${field.key}[${i}]`;
          this.fields.push(
            ...this.generateNestedField(field.nestedField, keyPrefix),
          );
        }
      } else {
        const keyPrefix = `${parentKey}${field.key}`;
        this.fields.push(
          ...this.generateNestedField(field.nestedField, keyPrefix),
        );
      }
    } else {
      const newNestedField: MulterField = {
        name:parentKey
          ? `${parentKey}[${field.name}]`
          : `${parentKey}${field.name}`
      };

      if(field.maxCount) {
        newNestedField.maxCount = field.maxCount;
      }

      (parentKey ? nestedFields : this.fields).push(newNestedField);

      if (this.withFieldNames && (isUndefined(field.required) || field.required)) {
        this.fieldNames.push(newNestedField.name);
      }
    }

    return nestedFields
  };
}
