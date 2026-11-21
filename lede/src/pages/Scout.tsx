import { useEffect, useMemo, useState } from 'react';
import { ExternalLink, Plus, X, Telescope, RefreshCw, HeartHandshake } from 'lucide-react';
import { Badge, Card, CardHead, Empty, PageHead, SearchBox, Seg } from '../components/ui';
import { DealEditor, blankDeal } from './Pipeline';
import { quickSearches, scoreOpp } from '../lib/scout';
import { fmtDate, today } from '../lib/dates';
import { gbp } from '../lib/format';
import { useVault } from '../lib/store';
import type { Deal, Opportunity } from '../lib/types';

interface Feed { generatedAt: string; sources: { name: string; ok: boolean; count: number; error?: string }[]; items: Opportunity[] }

export default function Scout() {
  const { vault, update } = useVault();
  const [feed, setFeed] = useState<Feed | null>();
  const [err, setErr] = useState('');
  const [q, setQ] = useState('');
  const [min, setMin] = useState<'all' | 'good' | 'best'>('good');
  const [nfpOnly, setNfpOnly] = useState(false);
  const [deal, setDeal] = useState<Deal>();
  const [term, setTerm] = useState('freelance communications');

  const load = () => {
    setErr(''); setFeed(undefined);
    fetch(`./opportunities.json?t=${Date.now()}`).then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then(setFeed).catch((e) => { setFeed(null); setErr(e.message); });
  };
  useEffect(load, []);

  const pipelineLinks = new Set(vault.deals.map((d) => d.link).filter(Boolean));
  const items = useMemo(() => (feed?.items ?? [])
    .filter((o) => !vault.dismissedOpps.includes(o.id))
    .map((o) => ({ o, ...scoreOpp(o, vault.settings.keywords) }))
    .filter((x) => (min === 'all' ? x.score > 0 : min === 'good' ? x.score >= 30 : x.score >= 60))
    .filter((x) => !nfpOnly || x.nfp)
    .filter((x) => !q || `${x.o.title} ${x.o.buyer} ${x.o.description}`.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => b.score - a.score || (b.o.published ?? '').localeCompare(a.o.published ?? '')), [feed, vault.dismissedOpps, vault.settings.keywords, min, nfpOnly, q]);

  const dismiss = (id: string) => update((v) => ({ ...v, dismissedOpps: [...v.dismissedOpps.slice(-2000), id] }));
  const toPipeline = (o: Opportunity) => setDeal(blankDeal({
    title: o.title, clientName: o.buyer, value: o.value ?? 0, source: o.source, link: o.url, stage: 'Lead', probability: 10,
    nextAction: o.deadline ? `Respond by ${fmtDate(o.deadline.slice(0, 10))}` : 'Review brief', notes: o.description?.slice(0, 1200),
  }));

  return (
    <>
      <PageHead eyebrow="Opportunity scout" title="Find the next brief" actions={<button className="btn" onClick={load}><RefreshCw size={16} />Refresh</button>} />
      <div className="grid g3">
        <div className="span2 stack">
          <Card>
            <div className="row wrap between" style={{ marginBottom: 6 }}>
              <Seg value={min} onChange={setMin} options={[{ value: 'best', label: 'Best matches' }, { value: 'good', label: 'Good' }, { value: 'all', label: 'Everything' }]} />
              <div className="row wrap">
                <label className="check small"><input type="checkbox" checked={nfpOnly} onChange={(e) => setNfpOnly(e.target.checked)} />Not-for-profit & public only</label>
                <SearchBox value={q} onChange={setQ} placeholder="Filter…" />
              </div>
            </div>
            {feed && <div className="tiny muted" style={{ marginBottom: 6 }}>Scanned {fmtDate(feed.generatedAt.slice(0, 10))} · {feed.sources.map((s) => `${s.name} ${s.ok ? s.count : '✕'}`).join(' · ')} · scored against your keywords in Settings</div>}
            {feed === undefined && <div className="muted">Loading the latest scan…</div>}
            {feed === null && <Empty icon={<Telescope size={30} />} title="No scan available yet">The scanner runs daily once the app is deployed (see the README). Meanwhile, use the quick searches. {err && <span className="tiny">({err})</span>}</Empty>}
            {feed && !items.length && <Empty icon={<Telescope size={30} />} title="Nothing matches right now">Try “Everything”, or broaden your keywords in Settings.</Empty>}
            <div className="list">{items.slice(0, 80).map(({ o, score, nfp, hits }) => (
              <div key={o.id} className="item" style={{ alignItems: 'flex-start' }}>
                <div className={`avatar ${score >= 60 ? 't-sage' : score >= 30 ? 't-butter' : 't-grey'}`} title="Match score" style={{ fontSize: 13 }}>{score}</div>
                <div className="grow">
                  <a href={o.url} target="_blank" rel="noreferrer" style={{ color: 'var(--ink)', textDecoration: 'none' }}><b>{o.title}</b></a>
                  <div className="small muted">{[o.buyer, o.location].filter(Boolean).join(' · ')}</div>
                  <div className="row wrap" style={{ gap: 6, marginTop: 6 }}>
                    <Badge tone="sky">{o.source}</Badge>
                    {nfp && <Badge tone="lav"><HeartHandshake size={11} />NFP / public</Badge>}
                    {o.value ? <Badge tone="sage">{gbp(o.value)}</Badge> : null}
                    {o.deadline && <Badge tone={o.deadline.slice(0, 10) < today() ? 'grey' : 'butter'}>Closes {fmtDate(o.deadline.slice(0, 10))}</Badge>}
                    {hits.slice(0, 3).map((h) => <span key={h} className="tiny muted">#{h}</span>)}
                  </div>
                </div>
                <div className="row" style={{ gap: 2 }}>
                  {pipelineLinks.has(o.url) ? <Badge tone="sage">In pipeline</Badge> : <button className="btn sm" onClick={() => toPipeline(o)}><Plus size={14} />Pipeline</button>}
                  <a className="btn ghost icon" href={o.url} target="_blank" rel="noreferrer" title="Open"><ExternalLink size={15} /></a>
                  <button className="btn ghost icon" title="Not for me" onClick={() => dismiss(o.id)}><X size={15} /></button>
                </div>
              </div>
            ))}</div>
          </Card>
        </div>
        <div className="stack">
          <Card tint="lav">
            <CardHead title="Quick searches" sub="Jump straight into the boards that don’t offer a feed" />
            <input className="input" value={term} onChange={(e) => setTerm(e.target.value)} style={{ marginBottom: 10 }} />
            <div className="list">{quickSearches(term).map((s) => (
              <a key={s.name} className="item" href={s.url} target="_blank" rel="noreferrer" style={{ textDecoration: 'none', color: 'inherit', padding: '9px 0' }}>
                <div className="grow"><b>{s.name}</b><div className="tiny muted">{s.note}</div></div><ExternalLink size={14} className="muted" />
              </a>))}
            </div>
          </Card>
          <Card tint="peach">
            <CardHead title="Found something elsewhere?" sub="Referrals, LinkedIn posts, newsletters…" />
            <button className="btn primary" onClick={() => setDeal(blankDeal({ source: 'Referral' }))}><Plus size={16} />Add to pipeline</button>
          </Card>
        </div>
      </div>
      {deal && <DealEditor deal={deal} onClose={() => setDeal(undefined)} />}
    </>
  );
}
