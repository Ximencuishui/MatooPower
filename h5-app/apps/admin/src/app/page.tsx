import { redirect } from 'next/navigation';

export default function RootPage() {
  // next.config.mjs 已配 redirects,此处为兜底
  redirect('/admin/overview');
}