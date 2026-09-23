// T6 Next.js instrumentation 注册
// - 仅 Node.js runtime 注册服务端配置；本项目不用 Next.js Edge runtime，省略 edge config
// - onRequestError：捕获 SSR 请求级错误（流式渲染、redirect 失败等）
// 参考：https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./sentry.server.config');
  }
  // Edge runtime：本项目无 edge API，可不导入
}

export const onRequestError = async (
  err: unknown,
  request: { path: string; method: string; headers: Record<string, string> },
  context: { routerKind: string; routePath: string; routeType: string; revalidateReason?: unknown }
) => {
  // 动态导入：避免 SSR 启动期与 Sentry SDK 抢占初始化
  const Sentry = await import('@sentry/nextjs');
  // captureRequestError 是 Sentry SDK 提供的官方 SSR 错误捕获入口
  Sentry.captureRequestError(err, request, context);
};