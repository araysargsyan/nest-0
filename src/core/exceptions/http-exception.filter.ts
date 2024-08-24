import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  InternalServerErrorException,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { resolve } from 'path';
import { PUBLIC_FOLDER } from '~constants/global.const';
import { Logger } from '~logger/Logger';

@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  private logger = new Logger('HttpExceptionFilter');

  constructor(private readonly configService: ConfigService) {
  }

  catch(exception: HttpException, host: ArgumentsHost) {
    console.log(5555, exception instanceof InternalServerErrorException);

    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const status = exception.getStatus();
    const errorResponse: any = exception.getResponse();

    this.logger.error(JSON.stringify({ exception, status, errorResponse}, null, 2));

    if (status === HttpStatus.NOT_FOUND) {
      response.sendFile(resolve(this.configService.get(PUBLIC_FOLDER)));
    } else {
      const messageAndStatus = {
        message: exception.message,
        errors: errorResponse,
      }

      response.status(status).json({
        timestamp: new Date().toISOString(),
        statusCode: status,
        path: request.url,
        ...messageAndStatus
      });
    }
  }
}
