// 简化版：4 个核心 smoke，每个独立临时 db
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { makeTmpDb, initDb, cleanDb, startApp } from './e2e/helpers';

describe('Matoo Power API · smoke (e2e)', () => {
  let dbFile: string;

  beforeEach(() => {
    dbFile = makeTmpDb();
    initDb(dbFile);
  });

  afterEach(() => {
    cleanDb(dbFile);
  });

  it('GET /sku/:id 不存在 → 404', async () => {
    const { req, close } = await startApp();
    try {
      const res = await req.get('/sku/NOT-EXIST-XYZ');
      expect(res.status).toBe(404);
    } finally {
      await close();
    }
  });

  it('POST /auth/otp/request → 200', async () => {
    const { req, close } = await startApp();
    try {
      const res = await req.post('/auth/otp/request').send({ phone: '+8801000000002' });
      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
    } finally {
      await close();
    }
  });

  it('POST /auth/email/login wrong creds → 401', async () => {
    const { req, close } = await startApp();
    try {
      const res = await req.post('/auth/email/login').send({ email: 'admin@matoo.dev', password: 'wrong' });
      expect([400, 401]).toContain(res.status);
    } finally {
      await close();
    }
  });

  it('GET /warranty/:id without JWT → 401', async () => {
    const { req, close } = await startApp();
    try {
      const res = await req.get('/warranty/some-id');
      expect(res.status).toBe(401);
    } finally {
      await close();
    }
  });
});