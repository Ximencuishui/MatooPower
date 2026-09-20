export interface SessionEntity {
  id: string;
  userId: string;
  token: string;
  expiresAt: Date;
  userAgent: string | null;
  ip: string | null;
  createdAt: Date;
}