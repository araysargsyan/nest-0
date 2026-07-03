import { Prisma } from '@prisma/client';
import { IsNumber, IsString, IsNotEmpty, IsPositive } from 'class-validator';
import { Exclude, Transform } from 'class-transformer';
import { ValidatorOptions } from '~decorators/validator-options.decorator';

@ValidatorOptions({whitelist: false})
export class CreateProductDto implements Omit<Prisma.ProductCreateInput, 'user'> {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsNumber()
  @Transform(({ value }) => Number(value))
  @IsPositive({ message: 'Price must be a positive number greater than 0' })
  price: number;

  @Exclude()
  images: string[]
}
