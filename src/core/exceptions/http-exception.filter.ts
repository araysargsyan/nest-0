import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common';
import { Request, Response } from 'express';
import { ConfigService } from '@nestjs/config';
// import { resolve } from 'path';

// import { PUBLIC_FOLDER } from '~/constants/upload.const';
@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  constructor(private readonly configService: ConfigService) {
  }

  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const status = exception.getStatus();

    if (status === HttpStatus.NOT_FOUND) {
      // response.sendFile(resolve(this.configService.get(PUBLIC_FOLDER)));
    } else {
      response.status(status).json({
        timestamp: new Date().toISOString(),
        statusCode: status,
        path: request.url,
        message: exception.message,
        errors: exception.getResponse(),
      });
    }
  }
}
