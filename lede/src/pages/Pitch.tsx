import { useMemo, useState } from 'react';
import { Star, Printer, Copy, Upload, Download, Trash2, FileText, Sparkles } from 'lucide-react';
import { Badge, Card, CardHead, Empty, Field, PageHead, Seg, confirmDelete } from '../components/ui';
import { clientName } from '../lib/analytics';
import { addDays, daysBetween, fmtDate, today } from '../lib/dates';
import { gbp, uid } from '../lib/format';
import { b64, unb64 } from '../lib/crypto';
import { useVault } from '../lib/store';
import type { Doc, Invoice, Profile, Vault } from '../lib/types';

type Tab = 'highlights' | 'builder' | 'profile' | 'docs';

export function rankWork(v: Vault, months = 24) {
  const since = addDays(today(), -30 * months);
  const recent = v.invoices.filter((i) => i.issueDate >= since);
  const maxV = Math.max(1, ...recent.map((i) => i.amount));
  return recent.map((i) => ({
    i,
    score: (i.profile ?? 3) * 2 + (i.showcase ? 4 : 0) + (i.amount / maxV) * 2 + Math.max(0, 1 - daysBetween(i.issueDate, today()) / 730) * 2,
  })).sort((a, b) => b.score - a.score);
}

export default function Pitch() {
  const [tab, setTab] = useState<Tab>('highlights');
  return (
    <>
      <PageHead eyebrow="Pitch studio" title="Show your best work" />
      <div style={{ marginBottom: 18 }}><Seg value={tab} onChange={setTab} options={[{ value: 'highlights', label: 'Recent highlights' }, { value: 'builder', label: 'CV & credentials' }, { value: 'profile', label: 'Profile' }, { value: 'docs', label: 'Documents' }]} /></div>
      {tab === 'highlights' && <Highlights />}
      {tab === 'builder' && <Builder />}
      {tab === 'profile' && <ProfileEditor />}
      {tab === 'docs' && <Docs />}
    </>
  );
}

function Highlights() {
  const { vault, upsert } = useVault();
  const ranked = useMemo(() => rankWork(vault), [vault]);
  // Group repeat work for the same client+description so the list stays readable.
  const seen = new Set<string>();
  const unique = ranked.filter(({ i }) => { const k = i.clientId + i.description; if (seen.has(k)) return false; seen.add(k); return true; });
  const lastCv = vault.docs.filter((d) => d.kind === 'CV').map((d) => d.updatedAt).sort().at(-1);
  const newSince = lastCv ? unique.filter(({ i }) => i.issueDate > lastCv && (i.showcase || (i.profile ?? 0) >= 4)).length : 0;
  const patch = (i: Invoice, p: Partial<Invoice>) => upsert('invoices', { ...i, ...p });

  return (
    <div className="stack">
      {lastCv && newSince > 0 && (
        <Card tint="butter"><div className="row"><Sparkles size={18} /><div><b>Your CV is {Math.round(daysBetween(lastCv, today()) / 30)} months old</b> — {newSince} standout project{newSince > 1 ? 's have' : ' has'} happened since. Build a fresh version in “CV &amp; credentials”.</div></div></Card>
      )}
      <Card>
        <CardHead title="Work from the last two years" sub="Ranked by how high-profile it was, value and recency. Star it, tick it for showcase, and write a one-line result — that’s what goes on your CV." />
        {!unique.length && <Empty icon={<Sparkles size={30} />} title="No recent invoices yet">Once work is invoiced it appears here, ready to turn into case studies.</Empty>}
        <div className="list">{unique.slice(0, 30).map(({ i }) => (
          <div key={i.id} className="item" style={{ alignItems: 'flex-start' }}>
            <input type="checkbox" checked={!!i.showcase} onChange={(e) => patch(i, { showcase: e.target.checked })} style={{ width: 18, height: 18, marginTop: 4, accentColor: 'var(--plum)' }} title="Showcase" />
            <div className="grow">
              <div className="row wrap between"><b>{i.description || 'Untitled work'}</b>
                <div className="row" style={{ gap: 0 }}>{[1, 2, 3, 4, 5].map((n) => (
                  <button key={n} className="btn ghost icon" style={{ padding: 2 }} onClick={() => patch(i, { profile: n })}><Star size={15} fill={(i.profile ?? 0) >= n ? '#e8b04b' : 'none'} color={(i.profile ?? 0) >= n ? '#e8b04b' : '#cbbfcf'} /></button>))}</div>
              </div>
              <div className="small muted">{clientName(vault, i.clientId)} · {fmtDate(i.issueDate)} · {gbp(i.amount)}</div>
              <input className="input" style={{ marginTop: 6, minHeight: 34, padding: '6px 10px', fontSize: 13.5 }} defaultValue={i.highlight ?? ''} placeholder="Result / highlight, e.g. ‘Raised £120k — 31% above target’"
                onBlur={(e) => e.target.value !== (i.highlight ?? '') && patch(i, { highlight: e.target.value })} />
            </div>
          </div>
        ))}</div>
      </Card>
    </div>
  );
}

function Builder() {
  const { vault } = useVault();
  const [kind, setKind] = useState<'cv' | 'credentials'>('cv');
  const [focus, setFocus] = useState<'all' | 'nfp'>('all');
  const [n, setN] = useState(5);
  const p = vault.profile, s = vault.settings;
  const sectorOf = (id: string) => vault.clients.find((c) => c.id === id)?.sector;
  const seen = new Set<string>();
  const picks = rankWork(vault, 36)
    .filter(({ i }) => i.showcase || (i.profile ?? 0) >= 4)
    .filter(({ i }) => focus === 'all' || ['Charity / NFP', 'Public sector', 'Health', 'Education'].includes(sectorOf(i.clientId) ?? ''))
    .filter(({ i }) => { const k = i.clientId + i.description; if (seen.has(k)) return false; seen.add(k); return true; })
    .slice(0, n).map((x) => x.i);
  const clientsList = [...new Set(vault.invoices.filter((i) => focus === 'all' || sectorOf(i.clientId) !== 'Private').map((i) => clientName(vault, i.clientId)))].slice(0, 14);

  const asText = () => [s.ownerName, p.headline, [s.email, s.phone, s.website].filter(Boolean).join(' · '), '', p.bio, '',
    'RECENT HIGHLIGHTS', ...picks.map((i) => `• ${clientName(vault, i.clientId)} — ${i.description}${i.highlight ? `. ${i.highlight}` : ''}`), '',
    'EXPERTISE', p.skills, '', 'SECTORS', p.sectors, ...(kind === 'cv' ? ['', 'EXPERIENCE', p.experience, '', 'EDUCATION & TRAINING', p.education] : ['', 'SELECTED CLIENTS', clientsList.join(', ')])].join('\n');

  return (
    <div className="grid g3">
      <Card>
        <CardHead title="Build" sub="Draws automatically on your highest-profile recent work" />
        <div className="stack" style={{ gap: 14 }}>
          <Field label="Document"><Seg value={kind} onChange={setKind} options={[{ value: 'cv', label: 'CV' }, { value: 'credentials', label: 'Credentials sheet' }]} /></Field>
          <Field label="Tailor for"><Seg value={focus} onChange={setFocus} options={[{ value: 'all', label: 'Any client' }, { value: 'nfp', label: 'Charity & public' }]} /></Field>
          <Field label={`Highlights · ${n}`}><input type="range" min={2} max={8} value={n} onChange={(e) => setN(Number(e.target.value))} style={{ accentColor: 'var(--plum)' }} /></Field>
          <button className="btn primary" onClick={() => window.print()}><Printer size={16} />Print / save PDF</button>
          <button className="btn" onClick={() => navigator.clipboard.writeText(asText()).then(() => alert('Copied — paste into Word or Google Docs.'))}><Copy size={16} />Copy as text</button>
          <div className="tiny muted">Edit the words in Profile; choose projects in Recent highlights.</div>
        </div>
      </Card>
      <div className="span2">
        <div className="doc-page printable">
          <h1 className="serif">{s.ownerName}</h1>
          <div style={{ fontSize: 16, color: 'var(--plum)', marginTop: 4 }}>{p.headline}</div>
          <div className="doc-rule" />
          <div style={{ color: '#666', fontSize: 12.5 }}>{[s.email, s.phone, s.website].filter(Boolean).join('  ·  ')}</div>
          <p style={{ fontSize: 14.5 }}>{p.bio}</p>
          <h2>{kind === 'cv' ? 'Recent highlights' : 'Selected work'}</h2>
          {picks.length ? picks.map((i) => (
            <div key={i.id} style={{ marginBottom: 10 }}>
              <b>{clientName(vault, i.clientId)}</b> — {i.description}
              {i.highlight && <div style={{ color: '#555' }}>{i.highlight}</div>}
              {kind === 'credentials' && <div style={{ color: '#999', fontSize: 12 }}>{new Date(i.issueDate).getFullYear()}</div>}
            </div>
          )) : <p className="muted">Star or showcase some recent work to fill this section.</p>}
          <h2>Expertise</h2><p>{p.skills}</p>
          <h2>Sectors</h2><p>{p.sectors}</p>
          {kind === 'cv' ? <>
            {p.experience && <><h2>Experience</h2>{p.experience.split(/\n\s*\n/).map((x, j) => <p key={j} style={{ whiteSpace: 'pre-line' }}>{x}</p>)}</>}
            {p.education && <><h2>Education &amp; training</h2><p style={{ whiteSpace: 'pre-line' }}>{p.education}</p></>}
          </> : <><h2>Selected clients</h2><p>{clientsList.join(' · ')}</p></>}
        </div>
      </div>
    </div>
  );
}

function ProfileEditor() {
  const { vault, update } = useVault();
  const p = vault.profile;
  const set = (k: keyof Profile, v: string) => update((x) => ({ ...x, profile: { ...x.profile, [k]: v } }));
  return (
    <Card>
      <CardHead title="Your profile" sub="The words used across your CV and credentials. Saved as you type." />
      <div className="form-grid">
        <Field label="Headline" full><input className="input" value={p.headline} onChange={(e) => set('headline', e.target.value)} /></Field>
        <Field label="Short bio" full><textarea className="input" rows={4} value={p.bio} onChange={(e) => set('bio', e.target.value)} /></Field>
        <Field label="Expertise (comma separated)" full><textarea className="input" rows={2} value={p.skills} onChange={(e) => set('skills', e.target.value)} /></Field>
        <Field label="Sectors" full><input className="input" value={p.sectors} onChange={(e) => set('sectors', e.target.value)} /></Field>
        <Field label="Experience" hint="One role per paragraph (blank line between)" full><textarea className="input" rows={8} value={p.experience} onChange={(e) => set('experience', e.target.value)} /></Field>
        <Field label="Education & training" full><textarea className="input" rows={3} value={p.education} onChange={(e) => set('education', e.target.value)} /></Field>
      </div>
    </Card>
  );
}

function Docs() {
  const { vault, upsert, remove } = useVault();
  const [kind, setKind] = useState<Doc['kind']>('CV');
  const add = async (files: FileList | null) => {
    for (const f of Array.from(files ?? [])) {
      if (f.size > 8 * 1024 * 1024) { alert(`${f.name} is over 8MB — try compressing it.`); continue; }
      upsert('docs', { id: uid(), name: f.name, kind, mime: f.type, size: f.size, data: b64(await f.arrayBuffer()), updatedAt: today() });
    }
  };
  const download = (d: Doc) => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([unb64(d.data)], { type: d.mime })); a.download = d.name; a.click(); };
  return (
    <Card>
      <CardHead title="Documents" sub="CVs, credentials decks, case studies and templates — encrypted with everything else" action={
        <div className="row"><select className="input" style={{ width: 'auto' }} value={kind} onChange={(e) => setKind(e.target.value as Doc['kind'])}>{['CV', 'Credentials', 'Case study', 'Proposal template', 'Other'].map((k) => <option key={k}>{k}</option>)}</select>
          <label className="btn primary"><Upload size={16} />Upload<input type="file" hidden multiple onChange={(e) => add(e.target.files)} /></label></div>} />
      {!vault.docs.length && <Empty icon={<FileText size={30} />} title="No documents yet">Upload your current CV so Lede can remind you when it’s due a refresh.</Empty>}
      <div className="list">{[...vault.docs].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).map((d) => {
        const age = daysBetween(d.updatedAt, today());
        return (
          <div key={d.id} className="item">
            <div className="avatar t-lav"><FileText size={16} /></div>
            <div className="grow"><div className="ellipsis"><b>{d.name}</b></div><div className="tiny muted">{d.kind} · {(d.size / 1024).toFixed(0)} KB · updated {fmtDate(d.updatedAt)}</div></div>
            {age > 180 && <Badge tone="butter">Due a refresh</Badge>}
            <button className="btn ghost icon" onClick={() => download(d)} title="Download"><Download size={16} /></button>
            <button className="btn ghost icon" onClick={() => confirmDelete(d.name) && remove('docs', d.id)} title="Delete"><Trash2 size={16} /></button>
          </div>
        );
      })}</div>
    </Card>
  );
}
