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
import { EnhanceFileInterceptor } from '@core/interceptors/enhanceFile';
import { MargeFilesToBodyPipe } from '@core/pipes/marge-files-to-body.pipe';
import { GenerateMultiFields } from '~helpers/generate-multi-fields';
// import { User } from '~decorators/request-user.decorator';

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
      {
        field: { name: 'images', maxCount: 200 },
        dest: 'public/uploads/products',
      },
    ),
  )
  async create(
    @Body() _: CreateProductDto,
    // @User('id') userId: number,
    @UploadedFiles(
      FileValidationPipe({
        fileTypes: VALID_UPLOADS_MIME_TYPES,
        fileIsRequired: true,
      }),
      MargeFilesToBodyPipe('path'),
    ) bodyWithImages: any,
  ) {
    console.log('CONTROLLER(product/create)', { bodyWithImages });
    return this.productService.create(bodyWithImages, /*userId ||*/ 1);
  }

  @Patch('document')
  @UseInterceptors(
    EnhanceFileInterceptor(
      FileInterceptor,
      {
        field: 'document',
        dest: 'public/uploads/products/documents',
      },
    ),
  )
  createDocument(
    @Body() { productId }: CreateProductDocumentDto,
    @UploadedFile(
      FileValidationPipe({
        fileTypes: VALID_UPLOADS_MIME_TYPES,
      }),
    ) document: Express.Multer.File,
  ) {
    console.log('CONTROLLER(product/create/document)', document, productId);
    return this.productService.createDocument(document.path || document.filename, productId);
  }

  static multiFields = new GenerateMultiFields([
    { name: 'multi1', maxCount: 2, fileTypes: VALID_UPLOADS_MIME_TYPES},
    { name: 'multi2', maxCount: 2, required: false },
  ], true)
  @Post('create-multi')
  @UseInterceptors(
    EnhanceFileInterceptor(
      FileFieldsInterceptor,
      {
        field: ProductController.multiFields.fields,
        dest: 'public/uploads/products/multi',
        errorFieldname: 'multiFiles',
      },
    ),
  )
  createMulti(
    @UploadedFiles(
      FileValidationPipe({
        fileTypes: ['audio/mpeg'],
        fileIsRequired: ProductController.multiFields.requiredFieldNames,
      }),
    ) files: Record<string, Express.Multer.File[]>,
  ) {
    console.log('CONTROLLER(product/create/multi)', files, ProductController.multiFields);
    return files;
  }

  @Post('any')
  @UseInterceptors(
    EnhanceFileInterceptor(
      AnyFilesInterceptor,
      {
        // limits: {
        //   files: 6,
        // },'
        dest: 'public/uploads/products/any',
        // asyncSaveFiles: true,
        field: [
          { //* images[0][files], images[1][files]
            key: 'images',
            length: Infinity,
            required: true,
            fileTypes: VALID_UPLOADS_MIME_TYPES, //! IF DEFINED, THEN FILE_PIPE fileTypes WILL BE IGNORED FOR THIS FIELD
            nestedField: {
              name: 'files',
              maxCount: 4,
            },
          },
          { //* a[0][b][0][c], a[1][b][0][c], a[0][b][1][c], a[1][b][1][c]
            key: 'a',
            length: 2,
            required: true,
            nestedField: {
              key: 'b',
              length: 2,
              nestedField: {
                name: 'c',
                maxCount: 3,
              },
            },
          },
          { //* a[b][0][c], a[b][1][c],
            key: 'a',
            required: false,
            nestedField: {
              key: 'b',
              length: 2,
              nestedField: {
                name: 'c',
                maxCount: 3,
              },
            },
          },
        ]
      },
    ),
  )
  createAny(
    @UploadedFiles(
      FileValidationPipe({
        fileTypes: ['audio/mpeg'],
        fileIsRequired: true, //! WILL CHECK ONLY NOT EMPTY FILES ARRAY
      }),
    ) files: any,
    @Body() body: any,
  ) {
    console.log({ files, body });
    return files;
  }

  static nestedFields = new GenerateMultiFields([
    // {
    //   required: true,
    //   name: 'files',
    //   maxCount: 4,
    // },
    { //* images[0][files], images[1][files]
      fileTypes: VALID_UPLOADS_MIME_TYPES,
      key: 'images',
      length: 2,
      nestedField: {
        name: 'files',
        maxCount: 4,
      },
    },
    { //* a[0][b][0][c], a[1][b][0][c], a[0][b][1][c], a[1][b][1][c]
      key: 'a',
      length: 2,
      required: false,
      nestedField: {
        key: 'b',
        length: 2,
        nestedField: {
          name: 'c',
          maxCount: 3,
        },
      },
    },
    { //* a[b][0][c], a[b][1][c],
      key: 'a',
      required: false,
      nestedField: {
        key: 'b',
        length: 2,
        nestedField: {
          name: 'c',
          maxCount: 3,
        },
      },
    },
  ], true)
  @Post('nested')
  @UseInterceptors(
    EnhanceFileInterceptor(
      FileFieldsInterceptor,
      {
        field: ProductController.nestedFields.fields,
        dest: 'public/uploads/products/nested',
        errorFieldname: 'nestedMultiFiles',
        // limits: {
        //   fileSize: 1
        // }
      },
    ),
  )
  createNestedFiles(
    @Body() body: any,
    @UploadedFiles(
      FileValidationPipe({
        fileTypes: ['audio/mpeg'],
        fileIsRequired: ProductController.nestedFields.requiredFieldNames,
      }),
    ) files: any,
  ) {
    console.log(ProductController.nestedFields)
    console.log(JSON.stringify({ files, body }, null, 2));
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
