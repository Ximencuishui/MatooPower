'use client';

interface Props {
  icon?: string;
  title: string;
  desc?: string;
}

export function EmptyState({ icon = '∅', title, desc }: Props) {
  return (
    <div className="card py-16 flex flex-col items-center justify-center text-slate-500">
      <div className="text-3xl mb-2" aria-hidden="true">
        {icon}
      </div>
      <div className="text-sm font-medium">{title}</div>
      {desc && <div className="text-xs mt-1 text-slate-400">{desc}</div>}
    </div>
  );
}