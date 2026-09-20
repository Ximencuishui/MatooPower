// 与 Prisma User 模型对齐的轻量接口（演示用，不强制校验）
export interface UserEntity {
  id: string;
  phone: string | null;
  email: string | null;
  passwordHash: string | null;
  role: 'customer' | 'dealer' | 'admin';
  displayName: string | null;
  createdAt: Date;
}