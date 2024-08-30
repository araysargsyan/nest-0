import { isUndefined } from '@nestjs/common/utils/shared.utils';
import { isBoolean } from 'class-validator';
import { TNestedMulterField } from '@core/interceptors/enhanceFile';
import { Field } from 'multer';

export class GenerateMultiFields {
  public fields: Field[] = [];
  public requiredFieldNames?: string[];
  public fileTypes?: Record<string, string[]>;

  constructor(
    nestedFields: TNestedMulterField[],
    private readonly options: {
      withRequiredFieldNames?: true,
      withFileTypes?: true
    } | boolean = false,
  ) {
    if (isBoolean(options) ? options : options.withRequiredFieldNames) {
      this.requiredFieldNames = [];
    }
    if (isBoolean(options) ? options : options.withFileTypes) {
      this.fileTypes = {};
    }

    nestedFields.forEach((field) => this.generateNestedField(field));
  }

  private generateNestedField(field: TNestedMulterField, parentKey = '', isRequired = false) {
    const nestedFields = [];
    let shouldBeRequired = isRequired

    if(!parentKey) {
      if ((isUndefined(field.required) || field.required)
        && (isBoolean(this.options) ? this.options : this.options.withRequiredFieldNames)
      ) {
        shouldBeRequired = true
      }
    }

    if ('nestedField' in field) {
      if ('length' in field) {
        for (let i = 0; i < field.length; i++) {
          const keyPrefix = parentKey
            ? `${parentKey}[${field.key}][${i}]`
            : `${parentKey}${field.key}[${i}]`;
          this.fields.push(
            ...this.generateNestedField(field.nestedField, keyPrefix, shouldBeRequired),
          );
        }
      } else {
        const keyPrefix = `${parentKey}${field.key}`;
        this.fields.push(
          ...this.generateNestedField(field.nestedField, keyPrefix, shouldBeRequired),
        );
      }
    } else {
      const newNestedField: Field = {
        name: parentKey
          ? `${parentKey}[${field.name}]`
          : `${parentKey}${field.name}`,
      };

      if (field.maxCount) {
        newNestedField.maxCount = field.maxCount;
      }

      (parentKey ? nestedFields : this.fields).push(newNestedField);
      if(field.fileTypes
        && (isBoolean(this.options) ? this.options : this.options.withFileTypes)
      ) {
        this.fileTypes[newNestedField.name] = field.fileTypes
      }
      if(shouldBeRequired) {
        this.requiredFieldNames.push(newNestedField.name);
      }
    }

    return nestedFields;
  };
}
