import { NextFunction, Request, Response } from 'express';
import { Injectable, Logger, NestMiddleware } from '@nestjs/common';

@Injectable()
export class LoggerMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    Logger.verbose(`Request to {${req.originalUrl}, ${req.method}} route`, 'LoggerMiddleware');
    next();
  }
}
