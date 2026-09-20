# `@matoo/shared`

> Matoo Power 共享包 — zod schema + 二维码 HMAC + 类型 / i18n key 枚举
>
> 被 `apps/web` 和 `apps/api` **共同消费**, 编译期防漂移.

- 包名: `@matoo/shared`
- 模块: ESM only (`"type": "module"`)
- TypeScript: `^5.4`
- 运行时依赖: `zod ^3.23`(只此一个)
- Node: `>=20.18`(用了 `crypto.subtle` + `node:test`)

## 目录

```
src/
├── types/         纯 TS 接口(零运行时开销)
├── schemas/       zod 校验 + z.infer<> 派生类型
├── qr/            HMAC-SHA256 签发/验签 + 二维码格式
└── i18n-keys/     i18n key 字面量联合类型(防拼写漂移)
```

## 安装与构建

```bash
cd E:\MatooPower\h5-app\packages\shared
npm install            # zod + tsx + typescript
npm run build          # tsc → ./dist
npm test               # node --test --import tsx test/
```

`pnpm-workspace.yaml` 已经声明 `packages/*`, 在仓库根 `pnpm install` 会自动 symlink.

## 关键 API

### HMAC 签发 / 验签 — `src/qr/signer.ts`

```ts
import { sign, verify, getRuntime } from '@matoo/shared/qr';

const sig = await sign('payload', 'secret');          // 64-char hex
const ok  = await verify('payload', sig, 'secret');  // true | false
```

- 自动选择运行时: 检测到 `process.versions.node` 走 `node:crypto.createHmac` + `timingSafeEqual`; 否则走 `crypto.subtle`(Web Crypto, 浏览器).
- 两个实现字节级等价, 跨 web/api 验签互通.

### 二维码格式 — `src/qr/format.ts`

```
Matoo:<skuId>:<serial>:<batch>:<hmacHex>
                    └─ HMAC-SHA256(skuId + ':' + serial + ':' + batch, secret)
```

```ts
import { encodeQrWithSecret, parseQr, verifyQr } from '@matoo/shared/qr';

const wire = await encodeQrWithSecret(
  { skuId: 'MP-12V-100Ah', serial: 'SN-001', batch: 'B1' },
  process.env.QR_SECRET!,
);
// "Matoo:MP-12V-100Ah:SN-001:B1:<64hex>"

const parsed = parseQr(wire);                                  // throws on malformed
const verified = await verifyQr(wire, process.env.QR_SECRET!); // throws on bad sig
```

### zod Schema — `src/schemas/*`

```ts
import { activateWarrantySchema, requestOtpSchema, type ActivateWarrantyDto } from '@matoo/shared/schemas';

const dto = activateWarrantySchema.parse(req.body);   // throws ZodError on bad input
```

| 文件 | DTO |
|---|---|
| `auth.ts` | `RequestOtpDto`, `VerifyOtpDto`, `LoginEmailDto` |
| `warranty.ts` | `ActivateWarrantyDto` |
| `device.ts` | `BindDeviceDto` |

### i18n keys — `src/i18n-keys/keys.ts`

```ts
import type { I18nKey } from '@matoo/shared';
import { ALL_I18N_KEYS } from '@matoo/shared';

// type-level guard: typo'd key fails compile
function t(key: I18nKey, vars?: Record<string, string | number>): string { /* ... */ }

t('scan.genuine');        // ✓
t('scan.gennuine');     // ✗ TS2322: Type '"scan.gennuine"' is not assignable to 'I18nKey'

// runtime validation
function isKnownKey(k: string): k is I18nKey {
  return (ALL_I18N_KEYS as readonly string[]).includes(k);
}
```

**总 leaf key 数: 213**, 由 `regex` 扫描 `apps/web/src/locales/zh-CN.ts` 得到(per-section breakdown: `app:2, tabs:4, home:11, scan:23, auth:21, activate:22, warranty:20, devices:9, device:13, common:7, compare:15, dealer:13, fail:12, legal:17, profile:12, scanEntry:12`).

> 当 `zh-CN.ts` 新增/删除 key, 必须同步更新 `keys.ts` 里的 `I18nKey` 联合 + `ALL_I18N_KEYS` 数组, 否则 `_enforceCount` 类型断言会触发 tsc 错误.

## 使用示例

### apps/web (前端)

```ts
import { activateWarrantySchema } from '@matoo/shared/schemas';
import { encodeQrWithSecret } from '@matoo/shared/qr';
import type { I18nKey } from '@matoo/shared';

const wire = await encodeQrWithSecret(
  { skuId, serial, batch },
  import.meta.env.PUBLIC_QR_SECRET,
);
```

### apps/api (后端)

```ts
import { activateWarrantySchema, type ActivateWarrantyDto } from '@matoo/shared/schemas';
import { verifyQr } from '@matoo/shared/qr';

@Post('activate')
activate(@Body() body: unknown) {
  const dto: ActivateWarrantyDto = activateWarrantySchema.parse(body);
  const payload = await verifyQr(dto.qrSignature, process.env.QR_SECRET!);
  // payload.skuId, payload.serial, payload.batch 都是受信任的字符串
}
```

## 测试

`test/signer.test.ts` 用 Node 内置 `node:test` + `tsx`, 覆盖:

- `sign + verify` 同一 payload → 通过
- 改 1 字节 payload → 验签失败
- 错 secret → 验签失败
- 错/被篡改 signature hex → 验签失败
- QR 编码 → 解析 → 验签 全链路
- 错 secret QR → `verifyQr` 抛错
- SKU 被篡改 QR → `verifyQr` 抛错
- 畸形字符串 → `parseQr` 抛错

```
npm test
# > @matoo/shared@0.1.0 test
# > node --test --import tsx test/
# TAP version 13
# # Subtest: sign + verify same payload → ok
# ok 1 - sign + verify same payload → ok
# ...
# # tests 7
# # pass 7
# # fail 0
```

## 不要做

- 不要复制 `zh-CN.ts` 的中文文案进 `keys.ts` — 只复制 key 路径.
- 不要在 web/api 里直接 `crypto.createHmac` — 一律 `@matoo/shared/qr`.
- 不要新增 `I18nKey` 而忘记更新 `ALL_I18N_KEYS`(及反之) — 编译期会报错.