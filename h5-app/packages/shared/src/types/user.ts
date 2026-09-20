// User-domain types shared by web & api.
// These are plain TS interfaces (no runtime cost). For request DTOs,
// prefer the zod schemas under src/schemas and `z.infer<>` the types.

export type UserId = string & { readonly __brand: 'UserId' };
export type PhoneE164 = string & { readonly __brand: 'PhoneE164' };

export type UserRole = 'consumer' | 'dealer' | 'admin';

export interface User {
  id: UserId;
  phone?: PhoneE164;
  email?: string;
  displayName?: string;
  role: UserRole;
  createdAt: string; // ISO-8601
}

export interface Session {
  userId: UserId;
  token: string;
  expiresAt: string; // ISO-8601
}