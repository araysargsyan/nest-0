import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../shared/prisma/prisma.service';
import { CreateProductDto } from '@modules/product/dto/create-product.dto';

@Injectable()
export class ProductService {
  constructor(private readonly prisma: PrismaService) {
  }

  create(createProductDto: CreateProductDto) {
    const { userId, ...data } = createProductDto;
    return this.prisma.product.create({
      data: {
        ...data,
        user: {
          connect: {
            id: userId
          },
        },
      },
      // include: {user: true}
    });
  }

  createDocument(document: string, productId: number) {
    return this.prisma.product.update({
      where: { id: productId },
      data: { document },
    });
  }

  findAll() {
    return 'This action returns all product';
  }

  findOne(id: number) {
    return `This action returns a #${id} product`;
  }

  update(id: number, updateProductDto: Prisma.ProductUpdateInput) {
    return `This action updates a #${id} product`;
  }

  remove(id: number) {
    return `This action removes a #${id} product`;
  }
}
