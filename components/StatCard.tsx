export function StatCard({
  label,
  value,
  sub,
  color,
  icon,
}: {
  label: string;
  value: string | number;
  sub?: string;
  color?: string;
  icon?: string;
}) {
  return (
    <div
      className="rounded-xl p-5 transition-all hover:scale-[1.02]"
      style={{
        backgroundColor: '#1A1A2E',
        border: '1px solid rgba(123, 45, 139, 0.3)',
        boxShadow: color ? `0 0 20px ${color}15` : 'none',
      }}
    >
      <div className="flex items-start justify-between">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: '#7B2D8B' }}>{label}</div>
          <div className="text-3xl font-black font-display" style={{ color: color || '#f8fafc' }}>{value}</div>
          {sub && <div className="text-xs mt-1" style={{ color: '#4a4a6a' }}>{sub}</div>}
        </div>
        {icon && <div className="text-2xl opacity-70">{icon}</div>}
      </div>
    </div>
  );
}
