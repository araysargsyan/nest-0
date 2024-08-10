import { Module } from '@nestjs/common';
import { UserService } from './user.service';
import { createUniqueConstraintProvider } from '~/constraints/unique.constraint';


@Module({
  providers: [
    UserService,
    createUniqueConstraintProvider(UserService),
  ],
  exports: [UserService]
})
export class UserModule {}
