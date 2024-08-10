import { Prisma } from '@prisma/client';
import { IsNumber, IsString, MinLength } from 'class-validator';
import { ValidatorOptions } from '~/decorators/validator-options.decorator';

@ValidatorOptions(null)
export class CreateProductDto implements Prisma.ProductCreateInput {
  @IsString()
  @MinLength(4)
  name: string;

  @IsNumber()
  prise: number;
}
