import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../shared/prisma/prisma.service';

@Injectable()
export class ProductService {
  constructor(private readonly prisma: PrismaService) {
  }

  create(createProductDto: Prisma.ProductCreateInput) {
    return this.prisma.product.create({ data: createProductDto });
  }

  createDocument(document: string, productId: number) {
    return this.prisma.product.update({
      where: {id: productId},
      data: {document}
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
