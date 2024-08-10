import { IsEmail, IsString } from 'class-validator';
import { IsUniqueDecorator } from '~/decorators/is-unique.decorator';

class BaseAuthDto {
  @IsString()
  password: string;
}

export class SignInDto extends BaseAuthDto{
  @IsEmail()
  email: string;
}

export class SignUpDto extends BaseAuthDto {
  @IsUniqueDecorator('isEmailUnique')
  @IsEmail()
  email: string;

  @IsUniqueDecorator('isEmailUnique')
  @IsString()
  name: string;

  @IsString()
  surname: string;
}
