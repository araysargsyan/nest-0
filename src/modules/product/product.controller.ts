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
  // UseGuards,
  Injectable,
  PipeTransform,
  Inject,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ProductService } from './product.service';
import { CreateProductDto } from './dto/create-product.dto';
import { CreateProductDocumentDto } from './dto/create-product-document.dto';
import {
  AnyFilesInterceptor,
  FileFieldsInterceptor,
  FileInterceptor,
  FilesInterceptor,
} from '@nestjs/platform-express';
import { FileValidationPipe } from '@core/pipes/file-validation.pipe';
import { EnhanceFileInterceptor } from '@core/interceptors/enhance-file.interceptor';
// import { User } from '~decorators/request-user.decorator';
import { REQUEST } from '@nestjs/core';


const VALID_UPLOADS_MIME_TYPES = ['image/jpeg', 'image/png'];


@Injectable()
export class MargeFilesToBodyPipe implements PipeTransform {
  // private logger = new Logger('FileValidationPipe');

  constructor(
    @Inject(REQUEST) readonly request: Request
  ) {}

  async transform(
    value: any,
    metadata: any,
  ) {
    console.log(`MargeFilesToBodyPipe$$ ${JSON.stringify({
      value,
      metadata,
      body: this.request.body
    }, null, 2)}`);


    return {
      ...this.request.body,
      files: value
    }
  }

}


@Controller('product')
export class ProductController {
  constructor(private readonly productService: ProductService) {
  }

  @Post()
  // @UseGuards(JwtAccessAuthGuard)
  @UseInterceptors(
    EnhanceFileInterceptor(
      FilesInterceptor,
      {
        field: { name: 'images', maxCount: 200 },
        dest: 'public/uploads/products',
      },
    ),
  )
  async create(
    @Body() createProductDto: CreateProductDto,
    // @User('id') userId: string,
    @UploadedFiles(
      FileValidationPipe({
        fileType: VALID_UPLOADS_MIME_TYPES,
        fileIsRequired: true,
      }),
      // MargeFilesToBodyPipe
    ) images?: Express.Multer.File[],
  ) {
    console.log('CONTROLLER(product/create)', { images });
    // return this.productService.create({
    //   ...createProductDto,
    //   userId: 1,
    //   images: images.map((img) => img.path),
    // });
  }

  @Patch('document')
  @UseInterceptors(
    // FileInterceptor('document'),
    EnhanceFileInterceptor(
      FileInterceptor,
      {
        field: 'document',
        dest: 'public/uploads/products/documents',
        // limits: {}
      },
    ),
  )
  createDocument(
    @Body() { productId }: CreateProductDocumentDto,
    @UploadedFile(
      FileValidationPipe({
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
      {
        field: [
          { name: 'multi1', maxCount: 2 },
          { name: 'multi2', maxCount: 2 },
        ],
        dest: 'public/uploads/products/multi',
        errorFieldname: 'files'
      }
    ),
  )
  createMulti(
    @UploadedFiles(
      FileValidationPipe({
        fileType: VALID_UPLOADS_MIME_TYPES,
        fileIsRequired: ['multi1'],
      }),
    ) files: Record<string, Express.Multer.File[]>,
  ) {
    console.log('CONTROLLER(product/create/multi)', files);
    return files
  }

  @Post('any')
  @UseInterceptors(
    EnhanceFileInterceptor(
      AnyFilesInterceptor,
      {
        limits: {
          files: 6,
        },
        dest: 'public/uploads/products/any',
        errorFieldname: 'anyfiles'
      }
    )
  )
  createAny(
    @UploadedFiles(
      FileValidationPipe({
        fileType: VALID_UPLOADS_MIME_TYPES,
        fileIsRequired: true,
      }),
    ) files: any,
    @Body() body: any
  ) {
    console.log({ files, body });
    return files;
  }

  @Post('nested')
  @UseInterceptors(
    EnhanceFileInterceptor(
      FilesInterceptor,
      {
        field: {
          name: 'images[4]',
          maxCount: 2,
        },
        dest: 'public/uploads/products',
      },
    ),
  )
  createNestedFiles(

  ) {

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
