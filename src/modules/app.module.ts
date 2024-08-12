import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { GlobalValidationPipe } from '@core/pipes/global-validation.pipe';
import { HttpExceptionFilter } from '@core/exceptions/http-exception.filter';
import { APP_FILTER, APP_PIPE } from '@nestjs/core';
import { SharedModule } from './shared/shared.module';
import { ProductModule } from './product/product.module';
import { UserModule } from './user/user.module';
import { LoggerMiddleware } from '@core/middlewares/logger-middleware';

@Module({
  imports: [SharedModule, UserModule, ProductModule],
  providers: [
    {
      provide: APP_FILTER,
      useClass: HttpExceptionFilter,
    },
    {
      provide: APP_PIPE,
      useClass: GlobalValidationPipe,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(LoggerMiddleware)
      .forRoutes('*');
  }
}
