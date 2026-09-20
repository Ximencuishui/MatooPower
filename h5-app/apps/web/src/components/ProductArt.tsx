// 一个零依赖的 SVG 产品图：储能电池"伪渲染"。原型阶段代替真实素材。
export function ProductArt({ variant = 'battery' as 'battery' | 'controller' | 'panel' }) {
  if (variant === 'battery') {
    return (
      <svg viewBox="0 0 320 200" className="w-full h-auto">
        <defs>
          <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#0E8F5A" />
            <stop offset="100%" stopColor="#0A6E45" />
          </linearGradient>
          <linearGradient id="g2" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#F8FAFC" />
            <stop offset="100%" stopColor="#E2E8F0" />
          </linearGradient>
        </defs>
        <rect x="20" y="30" width="280" height="150" rx="14" fill="url(#g2)" stroke="#CBD5E1" />
        <rect x="36" y="46" width="248" height="44" rx="6" fill="#fff" stroke="#E2E8F0" />
        <text x="160" y="74" textAnchor="middle" fontFamily="sans-serif" fontSize="20" fontWeight="700" fill="#0F172A">
          MATOO POWER
        </text>
        <text x="160" y="92" textAnchor="middle" fontFamily="sans-serif" fontSize="11" fill="#64748B">
          12.8V · 200Ah · LiFePO4
        </text>
        <rect x="36" y="100" width="248" height="60" rx="6" fill="#fff" stroke="#E2E8F0" />
        <circle cx="60" cy="130" r="6" fill="#FF7A1A" />
        <text x="76" y="134" fontFamily="sans-serif" fontSize="12" fill="#0F172A">+ 12V</text>
        <circle cx="200" cy="130" r="6" fill="#0E8F5A" />
        <text x="216" y="134" fontFamily="sans-serif" fontSize="12" fill="#0F172A">− GND</text>
        <rect x="40" y="8" width="40" height="22" rx="3" fill="url(#g1)" />
        <rect x="240" y="8" width="40" height="22" rx="3" fill="#FF7A1A" />
      </svg>
    );
  }
  if (variant === 'controller') {
    return (
      <svg viewBox="0 0 320 200" className="w-full h-auto">
        <rect x="40" y="30" width="240" height="140" rx="10" fill="#0F172A" />
        <rect x="60" y="50" width="200" height="46" rx="6" fill="#0E8F5A" />
        <text x="160" y="80" textAnchor="middle" fontFamily="sans-serif" fontSize="18" fill="#fff" fontWeight="700">
          BMS · 100A
        </text>
        <circle cx="80" cy="130" r="6" fill="#FF7A1A" />
        <circle cx="120" cy="130" r="6" fill="#0E8F5A" />
        <circle cx="160" cy="130" r="6" fill="#fff" />
        <circle cx="200" cy="130" r="6" fill="#fff" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 320 200" className="w-full h-auto">
      <rect x="20" y="40" width="280" height="120" rx="8" fill="#1E293B" />
      <g stroke="#475569">
        {Array.from({ length: 10 }).map((_, i) => (
          <line key={i} x1={30 + i * 28} y1="50" x2={30 + i * 28} y2="150" />
        ))}
        {Array.from({ length: 4 }).map((_, i) => (
          <line key={i} x1="30" y1={50 + i * 25} x2="300" y2={50 + i * 25} />
        ))}
      </g>
    </svg>
  );
}