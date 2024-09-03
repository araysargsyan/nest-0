import { isUndefined } from '@nestjs/common/utils/shared.utils';
import { isBoolean } from 'class-validator';
import { TNestedMulterField } from '@core/interceptors/enhanceFile';
import { EnhanceMulterOptions } from '@core/interceptors/enhanceFile/types';
import { FileFieldsInterceptor } from '@nestjs/platform-express';

export class GenerateMultiFields {
  public fields: EnhanceMulterOptions<typeof FileFieldsInterceptor>['field'] = [];
  public requiredFieldNames?: string[];

  constructor(
    nestedFields: TNestedMulterField[],
    private readonly withRequiredFieldNames: boolean = false,
  ) {
    if (withRequiredFieldNames) {
      this.requiredFieldNames = [];
    }

    nestedFields.forEach((field) => this.generateNestedField(field));
  }

  private generateNestedField(
    field: TNestedMulterField,
    parentKey = '',
    isRequired = false,
  ) {
    const nestedFields: typeof this.fields = [];
    let shouldBeRequired = isRequired;

    if (!parentKey) {
      if (this.withRequiredFieldNames && (isUndefined(field.required) || field.required)) {
        shouldBeRequired = true;
      }
    }

    if ('nestedField' in field) {
      if ('length' in field) {
        for (let i = 0; i < field.length; i++) {
          const keyPrefix = parentKey
            ? `${parentKey}[${field.key}][${i}]`
            : `${parentKey}${field.key}[${i}]`;
          this.fields.push(
            ...this.generateNestedField(
              {
                ...field.nestedField,
                fileTypes: field.fileTypes,
              },
              keyPrefix,
              shouldBeRequired,
            ),
          );
        }
      } else {
        const keyPrefix = `${parentKey}${field.key}`;
        this.fields.push(
          ...this.generateNestedField(
            {
              ...field.nestedField,
              fileTypes: field.fileTypes,
            },
            keyPrefix,
            shouldBeRequired
          ),
        );
      }
    } else {
      const newNestedField: (typeof this.fields)[0] = {
        name: parentKey
          ? `${parentKey}[${field.name}]`
          : `${parentKey}${field.name}`,
      };

      if (field.maxCount) {
        newNestedField.maxCount = field.maxCount;
      }

      if (field.fileTypes) {
        newNestedField.fileTypes = field.fileTypes;
      }

      (parentKey ? nestedFields : this.fields).push(newNestedField);
      if (shouldBeRequired) {
        this.requiredFieldNames.push(newNestedField.name);
      }
    }

    return nestedFields;
  };
}
