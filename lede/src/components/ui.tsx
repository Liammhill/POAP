import { X, Search } from 'lucide-react';
import { useEffect, type ReactNode } from 'react';
import { gbpK } from '../lib/format';

export type Tone = 'blush' | 'sage' | 'lav' | 'butter' | 'sky' | 'peach' | 'grey';

export const Card = ({ children, tint, className = '', ...rest }: { children: ReactNode; tint?: Tone; className?: string } & React.HTMLAttributes<HTMLDivElement>) => (
  <div className={`card ${tint ? 'tint-' + tint : ''} ${className}`} {...rest}>{children}</div>
);

export const CardHead = ({ title, sub, action }: { title: ReactNode; sub?: ReactNode; action?: ReactNode }) => (
  <div className="card-head">
    <div className="grow"><h2>{title}</h2>{sub && <div className="small muted" style={{ marginTop: 2 }}>{sub}</div>}</div>
    {action}
  </div>
);

export const Stat = ({ label, value, sub, icon, tone = 'lav', tint }: { label: ReactNode; value: ReactNode; sub?: ReactNode; icon?: ReactNode; tone?: Tone; tint?: Tone }) => (
  <Card className="stat" tint={tint}>
    <div className="row between">
      <div className="label"><span>{label}</span></div>
      {icon && <div className={`icon t-${tone}`}>{icon}</div>}
    </div>
    <div className="value">{value}</div>
    {sub && <div className="sub">{sub}</div>}
  </Card>
);

export const Badge = ({ tone = 'grey', children }: { tone?: Tone; children: ReactNode }) => <span className={`badge t-${tone}`}>{children}</span>;

export const PageHead = ({ eyebrow, title, actions }: { eyebrow?: string; title: ReactNode; actions?: ReactNode }) => (
  <div className="topbar">
    <div>{eyebrow && <div className="eyebrow">{eyebrow}</div>}<h1>{title}</h1></div>
    {actions && <div className="row wrap">{actions}</div>}
  </div>
);

export function Modal({ title, onClose, children, footer, wide }: { title: ReactNode; onClose: () => void; children: ReactNode; footer?: ReactNode; wide?: boolean }) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);
  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal ${wide ? 'wide' : ''}`} role="dialog" aria-modal>
        <div className="modal-head"><h2>{title}</h2><button className="btn ghost icon" onClick={onClose} aria-label="Close"><X size={18} /></button></div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  );
}

export const Field = ({ label, hint, children, full }: { label: string; hint?: ReactNode; children: ReactNode; full?: boolean }) => (
  <label className={`field ${full ? 'full' : ''}`}><span>{label}</span>{children}{hint && <span className="hint">{hint}</span>}</label>
);

export function Seg<T extends string>({ value, options, onChange }: { value: T; options: { value: T; label: ReactNode }[]; onChange: (v: T) => void }) {
  return (
    <div className="seg">{options.map((o) => <button key={o.value} className={o.value === value ? 'on' : ''} onClick={() => onChange(o.value)}>{o.label}</button>)}</div>
  );
}

export const SearchBox = ({ value, onChange, placeholder = 'Search…' }: { value: string; onChange: (s: string) => void; placeholder?: string }) => (
  <div className="search"><Search size={16} /><input className="input" value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} /></div>
);

export const Empty = ({ icon, title, children }: { icon?: ReactNode; title: string; children?: ReactNode }) => (
  <div className="empty">{icon}<div style={{ fontWeight: 600, color: 'var(--ink-2)' }}>{title}</div>{children && <div className="small" style={{ marginTop: 4 }}>{children}</div>}</div>
);

const PALETTE = ['#c9b6e4', '#f3c0b6', '#bcd9b6', '#f2d98f', '#b7d2e8', '#f6c9a5'];
export const initials = (s: string) => s.split(/\s+/).filter((w) => /^[A-Za-z]/.test(w)).slice(0, 2).map((w) => w[0].toUpperCase()).join('');
export const Avatar = ({ name }: { name: string }) => {
  const h = [...name].reduce((a, c) => a + c.charCodeAt(0), 0);
  return <div className="avatar" style={{ background: PALETTE[h % PALETTE.length], color: '#3b3142' }}>{initials(name) || '•'}</div>;
};

/** Stacked monthly bars. */
export function Bars({ data, series }: { data: { label: string; [k: string]: number | string }[]; series: { key: string; color: string; label: string }[] }) {
  const max = Math.max(1, ...data.map((d) => series.reduce((a, s) => a + (d[s.key] as number), 0)));
  return (
    <div>
      <div className="bars">
        {data.map((d, i) => {
          const total = series.reduce((a, s) => a + (d[s.key] as number), 0);
          return (
            <div className="bar" key={i} title={`${d.label}: ${series.map((s) => `${s.label} ${gbpK(d[s.key] as number)}`).join(' · ')}`}>
              <div className="tiny muted num" style={{ textAlign: 'center', visibility: total ? 'visible' : 'hidden' }}>{gbpK(total)}</div>
              <div className="stackcol" style={{ height: `${(total / max) * 78}%` }}>
                {series.map((s) => <div key={s.key} style={{ background: s.color, flex: (d[s.key] as number) || 0 }} />)}
              </div>
              <div className="lbl">{d.label}</div>
            </div>
          );
        })}
      </div>
      <div className="legend" style={{ marginTop: 12 }}>{series.map((s) => <span key={s.key}><i style={{ background: s.color }} />{s.label}</span>)}</div>
    </div>
  );
}

export const Meter = ({ value, color = 'var(--plum)' }: { value: number; color?: string }) => (
  <div className="meter"><div style={{ width: `${Math.max(0, Math.min(1, value)) * 100}%`, background: color }} /></div>
);

export const confirmDelete = (what: string) => window.confirm(`Delete ${what}? This can't be undone.`);
