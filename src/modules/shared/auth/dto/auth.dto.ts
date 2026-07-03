import { IsEmail, IsString, IsStrongPassword } from 'class-validator';
import { IsUnique } from '~/decorators/is-unique.decorator';

class BaseAuthDto {
  @IsString()
  @IsStrongPassword({}, {
    message: 'Password is too weak. It must be at least 8 characters long and contain uppercase, lowercase, numbers, and symbols.',
  })
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
