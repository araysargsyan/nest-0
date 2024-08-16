import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UploadedFile,
  UploadedFiles,
  UseInterceptors,
  UseGuards,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ProductService } from './product.service';
import { CreateProductDto } from './dto/create-product.dto';
import { CreateProductDocumentDto } from './dto/create-product-document.dto';
import { FileFieldsInterceptor, FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { FileValidationPipe } from '@core/pipes/file-validation.pipe';
import { EnhanceFileInterceptor } from '@core/interceptors/enhance-file.interceptor';
import { User } from '~decorators/request-user.decorator';


const VALID_UPLOADS_MIME_TYPES = ['image/jpeg', 'image/png'];
@Controller('product')
export class ProductController {
  constructor(private readonly productService: ProductService) {
  }

  @Post()
  // @UseGuards(JwtAccessAuthGuard)
  @UseInterceptors(
    EnhanceFileInterceptor(
      FilesInterceptor,
      { name: 'images', maxCount: 2 },
      {
        dest: 'public/uploads/products',
      },
    ),
  )
  create(
    @Body() createProductDto: CreateProductDto,
    // @User('id') userId: string,
    @UploadedFiles(
      new FileValidationPipe({
        fileType: VALID_UPLOADS_MIME_TYPES,
        fileIsRequired: true,
      }),
    ) images?: Express.Multer.File[],
  ) {
    console.log('CONTROLLER(product/create)', images);
    return this.productService.create({
      ...createProductDto,
      userId: 1,
      images: images.map((img) => img.path),
    });
  }

  @Patch('document')
  @UseInterceptors(
    EnhanceFileInterceptor(
      FileInterceptor,
      'document',
      {
        dest: 'public/uploads/products/documents',
      },
    ),
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
    return this.productService.createDocument(document.path || document.filename, productId);
  }

  @Post('create-multi')
  @UseInterceptors(
    EnhanceFileInterceptor(
      FileFieldsInterceptor,
      [
        { name: 'multi1', maxCount: 2 },
        { name: 'multi2', maxCount: 2 },
      ],{
        dest: 'public/uploads/products/multi',
        errorFieldname: 'files'
      }
    ),
  )
  createMulti(
    @UploadedFiles(
      new FileValidationPipe({
        fileType: VALID_UPLOADS_MIME_TYPES,
        fileIsRequired: ['multi1'],
      }),
    ) files: Record<string, Express.Multer.File[]>,
  ) {
    console.log('CONTROLLER(product/create/multi)', files);
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
