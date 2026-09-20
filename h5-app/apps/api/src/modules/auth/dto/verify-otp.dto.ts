import { IsString, Length, Matches } from 'class-validator';

export class VerifyOtpDto {
  @IsString()
  @Matches(/^\+\d{8,15}$/, { message: 'phone 必须以 + 开头并跟 8-15 位数字' })
  phone!: string;

  @IsString()
  @Length(6, 6, { message: '验证码必须是 6 位数字' })
  code!: string;
}