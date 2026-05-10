type Props = {
  label: string;
  value: number;
  max?: number;
  color?: string;
};

export function StatBar({ label, value, max = 100, color = "#c97a3c" }: Props) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div className="flex items-center gap-2 text-[11px] leading-none">
      <span className="w-16 uppercase tracking-wider text-bone/70">{label}</span>
      <div className="stat-bar flex-1">
        <div className="stat-fill" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="w-7 text-right tabular-nums">{Math.round(value)}</span>
    </div>
  );
}
