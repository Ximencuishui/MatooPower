// SQLite 单例（node:sqlite，Node 22+ 内置）
// 替换 @prisma/client：避免沙盒限制下 prisma generate 无法派生 query-engine 进程
//
// 用法：
//   import { db } from '../../common/db/db';
//   db.prepare('SELECT * FROM User WHERE id = ?').get(id);

import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
// @ts-ignore — node:sqlite is built into Node 22+, but TS types lag in @types/node@20
import sqlite from 'node:sqlite';
import * as path from 'path';

const { DatabaseSync } = sqlite as any;

@Injectable()
export class DbService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DbService.name);
  private _db!: any;

  constructor(private readonly cfg: ConfigService) {}

  onModuleInit() {
    const url = this.cfg.get<string>('DATABASE_URL') ?? 'file:./dev.db';
    const file = url.startsWith('file:') ? url.slice('file:'.length) : url;
    const dbPath = path.isAbsolute(file) ? file : path.resolve(process.cwd(), file);
    this.logger.log(`📦 SQLite at ${dbPath}`);
    this._db = new DatabaseSync(dbPath);
    this._db.exec('PRAGMA journal_mode = WAL;');
    this._db.exec('PRAGMA foreign_keys = ON;');
  }

  onModuleDestroy() {
    try { this._db?.close(); } catch { /* ignore */ }
  }

  get raw(): any { return this._db; }

  all<T = any>(sql: string, ...params: any[]): T[] {
    return this._db.prepare(sql).all(...params) as T[];
  }

  get<T = any>(sql: string, ...params: any[]): T | undefined {
    return this._db.prepare(sql).get(...params) as T | undefined;
  }

  run(sql: string, ...params: any[]): { changes: number; lastInsertRowid: number | bigint } {
    const r = this._db.prepare(sql).run(...params);
    return { changes: Number(r.changes), lastInsertRowid: r.lastInsertRowid };
  }
}

export const DB_SERVICE = DbService;