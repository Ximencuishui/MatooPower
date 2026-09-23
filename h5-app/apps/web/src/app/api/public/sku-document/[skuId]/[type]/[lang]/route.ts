// v1.3 P0:扫码页 → 后端公开文档 代理
// - 隐藏 NEXT_PUBLIC_API_BASE + 避免 CORS
// - 透传 Content-Type / Content-Disposition / Content-Length
import { NextRequest, NextResponse } from 'next/server';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? process.env.MATOO_API_BASE ?? 'http://localhost:3001';

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ skuId: string; type: string; lang: string }> },
) {
  const { skuId, type, lang } = await ctx.params;
  // 简单的入参校验,避免把异常路径丢给后端
  if (!skuId || !type || !lang) {
    return NextResponse.json({ error: 'MISSING_PARAMS', message: 'skuId/type/lang 必填' }, { status: 400 });
  }
  const targetUrl = `${API_BASE}/public/sku-document/${encodeURIComponent(skuId)}/${encodeURIComponent(type)}/${encodeURIComponent(lang)}`;
  try {
    const upstream = await fetch(targetUrl, {
      method: 'GET',
      // 公开端点不带 JWT,显式不传
      headers: { 'Accept-Language': req.headers.get('accept-language') ?? '' },
      // 关键:转发 304 / 流式时禁用缓存
      cache: 'no-store',
    });
    if (!upstream.ok) {
      // 透传 404 (无文档)/ 400 (非法 type/lang)
      const text = await upstream.text();
      let body: unknown;
      try { body = JSON.parse(text); } catch { body = { raw: text }; }
      return NextResponse.json(body as any, { status: upstream.status });
    }
    // 流式透传文件
    const headers = new Headers();
    headers.set('Content-Type', upstream.headers.get('content-type') ?? 'application/octet-stream');
    const disp = upstream.headers.get('content-disposition');
    if (disp) headers.set('Content-Disposition', disp);
    const cl = upstream.headers.get('content-length');
    if (cl) headers.set('Content-Length', cl);
    headers.set('Cache-Control', 'public, max-age=3600');
    // upstream.body 是 ReadableStream (Web Streams),Next.js 直接转发
    return new NextResponse(upstream.body, { status: 200, headers });
  } catch (e) {
    return NextResponse.json(
      { error: 'PROXY_ERROR', message: (e as Error).message ?? '代理失败' },
      { status: 502 },
    );
  }
}