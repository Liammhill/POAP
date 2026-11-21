import { useEffect, useRef, useState, type ReactNode } from 'react';
import { GLOSSARY, type GlossaryKey } from '../lib/glossary';

/** A term with a dotted underline; tap or hover to see what it means. */
export function Define({ k, children }: { k: GlossaryKey; children?: ReactNode }) {
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  const ref = useRef<HTMLButtonElement>(null);
  const show = () => {
    const r = ref.current!.getBoundingClientRect();
    setPos({ left: Math.min(Math.max(8, r.left), window.innerWidth - 288), top: r.bottom + 6 });
  };
  useEffect(() => {
    if (!pos) return;
    const close = (e: Event) => { if (!(e.target instanceof Node && ref.current?.contains(e.target))) setPos(null); };
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setPos(null);
    window.addEventListener('pointerdown', close); window.addEventListener('scroll', close, true); window.addEventListener('keydown', esc);
    return () => { window.removeEventListener('pointerdown', close); window.removeEventListener('scroll', close, true); window.removeEventListener('keydown', esc); };
  }, [pos]);
  const g = GLOSSARY[k];
  return (
    <>
      <button ref={ref} type="button" className="define" aria-expanded={!!pos} onClick={(e) => { e.stopPropagation(); pos ? setPos(null) : show(); }}
        onMouseEnter={show} onMouseLeave={() => setPos(null)}>
        {children ?? g.term}
      </button>
      {pos && <span className="define-pop" role="tooltip" style={pos}><b>{g.term}</b>{g.text}</span>}
    </>
  );
}

export function Glossary({ keys }: { keys: GlossaryKey[] }) {
  return (
    <dl className="glossary">
      {keys.map((k) => <div key={k}><dt>{GLOSSARY[k].term}</dt><dd>{GLOSSARY[k].text}</dd></div>)}
    </dl>
  );
}
