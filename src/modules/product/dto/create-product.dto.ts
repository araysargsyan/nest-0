import { Prisma } from '@prisma/client';
import { IsNumber, IsString } from 'class-validator';
import { Exclude, Transform } from 'class-transformer';

export class CreateProductDto implements Omit<Prisma.ProductCreateInput, 'user'> {
  @IsString()
  name: string;

  @IsNumber()
  @Transform(({ value }) => Number(value))
  price: number;

  @Exclude()
  images: string[]

  @Exclude()
  userId: number
}
