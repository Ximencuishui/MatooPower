'use client';
// P2-17:鼠标悬停也展示的跳过链接(从屏幕顶部滑出)
export function SkipLink() {
  return (
    <a
      href="#main-content"
      className="skip-link"
      onMouseEnter={(e) => (e.currentTarget.style.top = '0')}
      onMouseLeave={(e) => (e.currentTarget.style.top = '')}
    >
      跳到主要内容
    </a>
  );
}