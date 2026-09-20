import { IsString, Matches } from 'class-validator';

export class RequestOtpDto {
  @IsString()
  @Matches(/^\+\d{8,15}$/, { message: 'phone 必须以 + 开头并跟 8-15 位数字（含国际区号）' })
  phone!: string;
}