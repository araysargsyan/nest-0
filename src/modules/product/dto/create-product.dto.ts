import { Prisma } from '@prisma/client';
import { IsNumber, IsString } from 'class-validator';
import { Transform } from 'class-transformer';

export class CreateProductDto implements Omit<Prisma.ProductCreateInput, 'image'> {
  @IsString()
  name: string;

  @IsNumber()
  @Transform(({ value }) => Number(value))
  price: number;
}
