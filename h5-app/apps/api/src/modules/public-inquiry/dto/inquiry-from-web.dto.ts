// v1.4 T-2d X2 · Website inquiry DTO (public, anonymous)
// 来自 website/api/routes/inquiries.js 写完 inquiries.log 后,异步转发至此端点。
// Website 端 schema 字段:_form, _lang?, _source?, name?, company?, email?, phone?, message?, inquiryId?
// — 严格必填只有 _form;其余可选,但至少要 email 或 phone 之一(在 controller 兜底校验)。

import { IsEmail, IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export const ALLOWED_FORMS = [
  'contact',
  'inquiry',
  'factory-visit',
  'spec-download',
  'roi-calc',
  'bp-request',
  'e-cert-request',
  'newsletter',
  'inline',
] as const;

export type InquiryForm = (typeof ALLOWED_FORMS)[number];

export class InquiryFromWebDto {
  @IsString()
  @IsIn(ALLOWED_FORMS as readonly string[] as string[])
  _form!: InquiryForm;

  @IsOptional()
  @IsString()
  @MaxLength(8)
  _lang?: string;

  @IsOptional()
  @IsString()
  @MaxLength(256)
  _source?: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  company?: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(254)
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  phone?: string;

  @IsOptional()
  @IsString()
  @MinLength(5)
  @MaxLength(4096)
  message?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  inquiryId?: string;
}