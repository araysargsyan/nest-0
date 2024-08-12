import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UploadedFile, UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ProductService } from './product.service';
import { CreateProductDto } from './dto/create-product.dto';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { FileValidationPipe } from '@core/pipes/file-validation.pipe';
import { FileMixInterceptor } from '@core/interceptors/file-mix.interceptor';
import { CreateProductDocumentDto } from '@modules/product/dto/create-product-document.dto';

const VALID_UPLOADS_MIME_TYPES = ['image/jpeg', 'image/png'];


@Controller('product')
export class ProductController {
  constructor(private readonly productService: ProductService) {}

  @Post()
  @UseInterceptors(
    FileMixInterceptor(() => FilesInterceptor('images', 2, {
      dest: 'public/uploads/products',
      limits: {
        // fileSize: 20,
        files: 2,
      },
    })),
  )
  create(
    @Body() createProductDto: CreateProductDto,
    @UploadedFiles(
      new FileValidationPipe({
        fileType: VALID_UPLOADS_MIME_TYPES,
        fileIsRequired: false
      }),
    ) images?: Express.Multer.File[],
  ) {
    console.log('CONTROLLER(product/create)');
    return this.productService.create({
      ...createProductDto,
      images: images.map((img) => img.path)
    });
  }

  @Patch('document')
  @UseInterceptors(
    FileMixInterceptor(() => FileInterceptor('document', {
      dest: 'public/uploads/products/documents',
      limits: {
        // fileSize: 20,
        files: 1,
      },
    }))
  )
  createDocument(
    @Body() { productId }: CreateProductDocumentDto,
    @UploadedFile(
      new FileValidationPipe({
        fileType: VALID_UPLOADS_MIME_TYPES,
      }),
    ) document: Express.Multer.File,
  ) {
    console.log('CONTROLLER(product/create/document)', document);
    return this.productService.createDocument(document.path || document.filename, productId)
  }

  @Get()
  findAll() {
    return this.productService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.productService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateProductDto: Prisma.ProductUpdateInput) {
    return this.productService.update(+id, updateProductDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.productService.remove(+id);
  }
}
