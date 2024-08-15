import { IsEmail, IsString } from 'class-validator';
import { IsUnique } from '~/decorators/is-unique.decorator';

class BaseAuthDto {
  @IsString()
  password: string;
}

export class SignInDto extends BaseAuthDto{
  @IsEmail()
  email: string;
}

export class SignUpDto extends BaseAuthDto {
  @IsUnique('isEmailUnique')
  @IsEmail()
  email: string;

  @IsUnique('isEmailUnique')
  @IsString()
  name: string;

  @IsString()
  surname: string;
}
