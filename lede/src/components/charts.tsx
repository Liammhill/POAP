import { useEffect, useRef, useState } from 'react';

export interface Series { name: string; color: string; values: (number | null)[]; width?: number; area?: boolean; opacity?: number }

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [w, setW] = useState(600);
  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(260, e.contentRect.width)));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}

/** Round tick step (1, 2, 2.5 or 5 × 10ⁿ) giving about four gridlines. */
function niceScale(v: number) {
  const raw = Math.max(v, 1) / 4;
  const p = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * p).find((m) => m >= raw)!;
  const max = Math.ceil(Math.max(v, 1) / step) * step;
  return { max, ticks: Array.from({ length: Math.round(max / step) + 1 }, (_, i) => i * step) };
}

/** Multi-series line chart: one y-axis, recessive grid, direct end labels, crosshair tooltip. */
export function LineChart({ labels, series, height = 230, fmt, axisFmt = fmt, showEndLabels = true }: {
  labels: string[]; series: Series[]; height?: number; fmt: (n: number) => string; axisFmt?: (n: number) => string; showEndLabels?: boolean;
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const endRoom = showEndLabels ? 64 : 12;
  const pad = { l: 50, r: endRoom, t: 12, b: 26 };
  const W = width, H = height, iw = W - pad.l - pad.r, ih = H - pad.t - pad.b;
  const { max, ticks } = niceScale(Math.max(...series.flatMap((s) => s.values.filter((x): x is number => x !== null)), 0));
  const x = (i: number) => pad.l + (labels.length < 2 ? iw / 2 : (i * iw) / (labels.length - 1));
  const y = (v: number) => pad.t + ih - (v / max) * ih;
  const every = Math.ceil(labels.length / Math.max(2, Math.floor(iw / 46)));

  const path = (vals: (number | null)[]) => {
    let d = '', pen = false;
    vals.forEach((v, i) => { if (v === null) { pen = false; return; } d += `${pen ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`; pen = true; });
    return d;
  };
  // End labels, nudged apart so they don't collide.
  const ends = series.map((s) => { const i = s.values.reduce<number>((a, v, j) => (v !== null ? j : a), -1); return { s, i, yy: i >= 0 ? y(s.values[i]!) : 0 }; })
    .filter((e) => e.i >= 0).sort((a, b) => a.yy - b.yy);
  for (let k = 1; k < ends.length; k++) if (ends[k].yy - ends[k - 1].yy < 14) ends[k].yy = ends[k - 1].yy + 14;

  const onMove = (e: React.PointerEvent<SVGRectElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - r.left;
    const i = Math.round(((px) / r.width) * (labels.length - 1));
    setHover(Math.max(0, Math.min(labels.length - 1, i)));
  };
  const tipLeft = hover !== null ? Math.min(Math.max(x(hover) + 12, 0), W - 170) : 0;
  const flip = hover !== null && x(hover) + 182 > W;

  return (
    <div ref={ref} style={{ position: 'relative', width: '100%' }}>
      <svg width={W} height={H} role="img" aria-label={`Line chart: ${series.map((s) => s.name).join(', ')}`} style={{ display: 'block', overflow: 'visible' }}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} stroke="var(--line)" strokeWidth={1} />
            <text x={pad.l - 8} y={y(t) + 4} textAnchor="end" fontSize={11} fill="var(--muted)">{axisFmt(t)}</text>
          </g>
        ))}
        {labels.map((l, i) => i % every === 0 && <text key={i} x={x(i)} y={H - 6} textAnchor="middle" fontSize={11} fill="var(--muted)">{l}</text>)}
        {series.map((s) => s.area && (
          <path key={s.name + 'a'} d={`${path(s.values)}L${x(s.values.length - 1)},${y(0)}L${x(s.values.findIndex((v) => v !== null))},${y(0)}Z`} fill={s.color} opacity={0.1} />
        ))}
        {series.map((s) => <path key={s.name} d={path(s.values)} fill="none" stroke={s.color} strokeOpacity={s.opacity ?? 1} strokeWidth={s.width ?? 2} strokeLinejoin="round" strokeLinecap="round" />)}
        {showEndLabels && ends.map(({ s, i, yy }) => (
          <g key={s.name + 'e'}>
            <circle cx={x(i)} cy={y(s.values[i]!)} r={4} fill={s.color} stroke="var(--surface)" strokeWidth={2} />
            <text x={x(i) + 9} y={yy + 4} fontSize={11.5} fontWeight={600} fill="var(--ink-2)">{s.name}</text>
          </g>
        ))}
        {hover !== null && <>
          <line x1={x(hover)} x2={x(hover)} y1={pad.t} y2={pad.t + ih} stroke="var(--ink-2)" strokeWidth={1} strokeDasharray="3 3" />
          {series.map((s) => s.values[hover] !== null && <circle key={s.name + 'h'} cx={x(hover)} cy={y(s.values[hover]!)} r={4.5} fill={s.color} stroke="var(--surface)" strokeWidth={2} />)}
        </>}
        <rect x={pad.l} y={pad.t} width={iw} height={ih} fill="transparent" onPointerMove={onMove} onPointerDown={onMove} onPointerLeave={() => setHover(null)} style={{ touchAction: 'pan-y' }} />
      </svg>
      {hover !== null && (
        <div className="chart-tip" style={{ left: flip ? undefined : tipLeft, right: flip ? W - x(hover) + 12 : undefined, top: 4 }}>
          <div className="tiny muted" style={{ marginBottom: 4 }}>{labels[hover]}</div>
          {series.map((s) => (
            <div key={s.name} className="row between small" style={{ gap: 14 }}>
              <span className="row" style={{ gap: 6 }}><i style={{ width: 10, height: 3, borderRadius: 2, background: s.color, display: 'inline-block' }} />{s.name}</span>
              <b className="num">{s.values[hover] === null ? '—' : fmt(s.values[hover]!)}</b>
            </div>
          ))}
        </div>
      )}
      {series.length > 1 && <div className="legend" style={{ marginTop: 8 }}>{series.map((s) => <span key={s.name}><i style={{ background: s.color, height: 3, verticalAlign: 3 }} />{s.name}</span>)}</div>}
    </div>
  );
}

/** Single-hue sequential heatmap (light → plum). */
const LO = [243, 238, 248], HI = [94, 74, 114];
const ramp = (t: number) => `rgb(${LO.map((l, k) => Math.round(l + (HI[k] - l) * t)).join(',')})`;

export function Heatmap({ rows, cols, fmt, cellFmt }: { rows: { label: string; values: (number | null)[] }[]; cols: string[]; fmt: (n: number) => string; cellFmt: (n: number) => string }) {
  const max = Math.max(1, ...rows.flatMap((r) => r.values.filter((v): v is number => v !== null)));
  return (
    <div className="table-wrap">
      <div className="heat" style={{ gridTemplateColumns: `64px repeat(${cols.length}, minmax(34px, 1fr))` }}>
        <div />
        {cols.map((c) => <div key={c} className="tiny muted" style={{ textAlign: 'center' }}>{c}</div>)}
        {rows.map((r) => [
          <div key={r.label} className="tiny" style={{ fontWeight: 600, alignSelf: 'center' }}>{r.label}</div>,
          ...r.values.map((v, i) => {
            const t = v === null ? 0 : Math.sqrt(v / max);
            return (
              <div key={r.label + i} className="heat-cell" title={`${cols[i]} ${r.label}: ${v === null ? 'not yet' : fmt(v)}`}
                style={{ background: v === null ? 'transparent' : ramp(t), color: t > 0.55 ? '#fff' : 'var(--ink-2)', border: v === null ? '1px dashed var(--line)' : undefined }}>
                {v === null ? '' : cellFmt(v)}
              </div>
            );
          }),
        ])}
      </div>
      <div className="row tiny muted" style={{ marginTop: 8, gap: 6 }}>Less<span style={{ width: 90, height: 8, borderRadius: 4, background: `linear-gradient(90deg, ${ramp(0)}, ${ramp(1)})` }} />More</div>
    </div>
  );
}
