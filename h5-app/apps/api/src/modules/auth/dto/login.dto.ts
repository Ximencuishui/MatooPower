import { IsEmail, IsString, MinLength } from 'class-validator';

export class LoginDto {
  @IsEmail({}, { message: 'email 必须是合法邮箱地址' })
  email!: string;

  @IsString()
  @MinLength(6, { message: 'password 至少 6 位' })
  password!: string;
}