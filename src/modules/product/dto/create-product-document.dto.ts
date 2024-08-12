import { IsNumber, Min } from 'class-validator';
import { Transform } from 'class-transformer';

export class CreateProductDocumentDto {
  @Min(1)
  @IsNumber()
  @Transform(({ value }) => Number(value))
  productId: number
}
