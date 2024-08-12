import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common';
import { Request, Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { resolve } from 'path';
import { PUBLIC_FOLDER } from '~constants/global.const';
import { FIELD_NAME_FROM_REQ } from '../pipes/types';

@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  constructor(private readonly configService: ConfigService) {
  }

  catch(exception: HttpException, host: ArgumentsHost) {
    console.log('HttpExceptionFilter');
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const status = exception.getStatus();
    const errorResponse: any = exception.getResponse();

    console.log({ exception, host, status, err: exception.getResponse(), errorResponse});

    if (status === HttpStatus.NOT_FOUND) {
      response.sendFile(resolve(this.configService.get(PUBLIC_FOLDER)));
    } else {
      const messageAndStatus = {
        message: exception.message,
        errors: errorResponse,
      }

      if (exception.message.includes('PARSE_JSON')) {
        messageAndStatus.message = errorResponse.error
        const {PARSE_JSON, ...errors} = JSON.parse(exception.message)
        messageAndStatus.errors = errors
      } else if (Object.keys(errorResponse).includes(FIELD_NAME_FROM_REQ)) {
        messageAndStatus.errors[request[FIELD_NAME_FROM_REQ]] = messageAndStatus.errors[FIELD_NAME_FROM_REQ]
        delete messageAndStatus.errors[FIELD_NAME_FROM_REQ]
        delete request[FIELD_NAME_FROM_REQ]
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
