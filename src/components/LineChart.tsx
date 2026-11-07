type Point = { label: string; value: number };

/** Gráfico de linha simples em SVG. `invert` põe valores menores no alto (ex.: posição no ranking). */
export default function LineChart({
  points,
  min,
  max,
  invert = false,
  color = "var(--accent-text)",
  format = (v: number) => String(v),
}: {
  points: Point[];
  min: number;
  max: number;
  invert?: boolean;
  color?: string;
  format?: (v: number) => string;
}) {
  if (points.length === 0) return null;
  const W = 600;
  const H = 180;
  const pad = { l: 36, r: 16, t: 16, b: 28 };
  const x = (i: number) => pad.l + (points.length === 1 ? (W - pad.l - pad.r) / 2 : (i * (W - pad.l - pad.r)) / (points.length - 1));
  const y = (v: number) => {
    const t = (v - min) / (max - min || 1);
    return pad.t + (invert ? t : 1 - t) * (H - pad.t - pad.b);
  };
  const ticks = [min, (min + max) / 2, max];
  const path = points.map((p, i) => `${i ? "L" : "M"}${x(i)},${y(p.value)}`).join(" ");
  const every = Math.ceil(points.length / 6);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto" }} role="img">
      {ticks.map((t) => (
        <g key={t}>
          <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} stroke="var(--line)" />
          <text x={pad.l - 6} y={y(t) + 4} fontSize="11" textAnchor="end" fill="var(--muted)">
            {format(Math.round(t * 10) / 10)}
          </text>
        </g>
      ))}
      <path d={path} fill="none" stroke={color} strokeWidth="2.5" />
      {points.map((p, i) => (
        <g key={i}>
          <circle cx={x(i)} cy={y(p.value)} r="4" fill={color}>
            <title>{`${p.label}: ${format(p.value)}`}</title>
          </circle>
          {i % every === 0 && (
            <text x={x(i)} y={H - 8} fontSize="11" textAnchor="middle" fill="var(--muted)">
              {p.label}
            </text>
          )}
        </g>
      ))}
    </svg>
  );
}
