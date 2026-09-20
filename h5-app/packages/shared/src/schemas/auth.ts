import { z } from 'zod';

// Phone: accept +86 / +880 prefixes in demo; loosen to E.164 elsewhere.
const phoneSchema = z
  .string()
  .min(8)
  .max(20)
  .regex(/^\+?[0-9]{6,15}$/, 'phone must be digits with optional leading +');

const otpSchema = z
  .string()
  .regex(/^\d{6}$/, 'OTP must be 6 digits');

export const requestOtpSchema = z.object({
  phone: phoneSchema,
});
export type RequestOtpDto = z.infer<typeof requestOtpSchema>;

export const verifyOtpSchema = z.object({
  phone: phoneSchema,
  code: otpSchema,
});
export type VerifyOtpDto = z.infer<typeof verifyOtpSchema>;

export const loginEmailSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
});
export type LoginEmailDto = z.infer<typeof loginEmailSchema>;