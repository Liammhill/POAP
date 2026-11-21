#!/usr/bin/env node
// Daily opportunity scan. Runs server-side (GitHub Actions) so there are no browser CORS limits.
// Pulls public UK procurement notices + job-board RSS feeds, keeps comms-related items, writes JSON.
// Usage: node scanner/scan.mjs public/opportunities.json
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';

const cfg = JSON.parse(await readFile(new URL('./config.json', import.meta.url), 'utf8'));
const out = process.argv[2] ?? 'opportunities.json';
const KEEP = new RegExp(cfg.keepIfMatches, 'i');
const since = new Date(Date.now() - cfg.daysBack * 864e5);
const iso = (d) => d.toISOString().slice(0, 19);
const UA = { 'User-Agent': 'lede-opportunity-scout/1.0', Accept: 'application/json, application/xml, text/xml, */*' };

async function get(url, as = 'json') {
  const ctl = AbortSignal.timeout(30_000);
  const r = await fetch(url, { headers: UA, signal: ctl });
  if (!r.ok) throw new Error(`HTTP ${r.status} for ${url}`);
  return as === 'json' ? r.json() : r.text();
}

const strip = (s = '') => String(s).replace(/<!\[CDATA\[|\]\]>/g, '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#39;|&apos;/g, "'").replace(/&quot;/g, '"').replace(/\s+/g, ' ').trim();

function relevant(o, cpvs = []) {
  return KEEP.test(`${o.title} ${o.description ?? ''}`) || cpvs.some((c) => cfg.cpvPrefixes.some((p) => String(c).startsWith(p)));
}

function fromOcds(rel, source, urlFor) {
  const t = rel.tender ?? {};
  const buyer = rel.buyer?.name ?? rel.parties?.find((p) => p.roles?.includes('buyer'))?.name;
  const addr = rel.parties?.find((p) => p.roles?.includes('buyer'))?.address;
  const cpvs = [t.classification?.id, ...(t.items ?? []).flatMap((i) => [i.classification?.id, ...(i.additionalClassifications ?? []).map((c) => c.id)])].filter(Boolean);
  const o = {
    id: `${source}:${rel.ocid ?? rel.id}`,
    title: strip(t.title ?? rel.title ?? 'Untitled notice'),
    buyer: buyer ? strip(buyer) : undefined,
    description: strip(t.description ?? '').slice(0, 1500),
    value: t.value?.amount ?? t.minValue?.amount ?? undefined,
    deadline: t.tenderPeriod?.endDate,
    published: rel.date,
    url: urlFor(rel),
    source,
    location: [addr?.locality, addr?.region].filter(Boolean).join(', ') || undefined,
  };
  return relevant(o, cpvs) ? o : null;
}

async function paged(firstUrl, maxPages = 15) {
  const all = [];
  let url = firstUrl;
  for (let i = 0; url && i < maxPages; i++) {
    const j = await get(url);
    const rels = j.releases ?? j.results?.flatMap((r) => r.releases ?? []) ?? [];
    all.push(...rels);
    url = j.links?.next && j.links.next !== url ? j.links.next : null;
  }
  return all;
}

const sources = [
  {
    name: 'Contracts Finder',
    run: async () => {
      const rels = await paged(`https://www.contractsfinder.service.gov.uk/Published/Notices/OCDS/Search?publishedFrom=${iso(since)}&publishedTo=${iso(new Date())}&stages=tender&limit=100`);
      return rels.map((r) => fromOcds(r, 'Contracts Finder', (x) => {
        const nid = String(x.ocid ?? '').replace(/^ocds-b5fd17-/, '') || x.id;
        return `https://www.contractsfinder.service.gov.uk/notice/${nid}`;
      }));
    },
  },
  {
    name: 'Find a Tender',
    run: async () => {
      const rels = await paged(`https://www.find-tender.service.gov.uk/api/1.0/ocdsReleasePackages?updatedFrom=${iso(since)}&stages=tender&limit=100`);
      return rels.map((r) => fromOcds(r, 'Find a Tender', (x) => `https://www.find-tender.service.gov.uk/Notice/${String(x.id).split('/')[0]}`));
    },
  },
  ...cfg.rss.map((feed) => ({
    name: feed.name,
    run: async () => {
      const xml = await get(feed.url, 'text');
      const items = xml.match(/<(item|entry)[\s>][\s\S]*?<\/\1>/g) ?? [];
      const tag = (s, t) => s.match(new RegExp(`<${t}[^>]*>([\\s\\S]*?)</${t}>`, 'i'))?.[1];
      return items.map((it) => {
        const link = strip(tag(it, 'link') ?? '') || it.match(/<link[^>]*href="([^"]+)"/)?.[1] || '';
        const o = {
          id: `${feed.name}:${strip(tag(it, 'guid') ?? '') || link}`,
          title: strip(tag(it, 'title')),
          description: strip(tag(it, 'description') ?? tag(it, 'summary') ?? tag(it, 'content') ?? '').slice(0, 1500),
          published: (() => { const d = new Date(strip(tag(it, 'pubDate') ?? tag(it, 'updated') ?? '')); return isNaN(d) ? undefined : d.toISOString(); })(),
          url: link,
          source: feed.name,
        };
        return o.title && o.url && relevant(o) ? o : null;
      });
    },
  })),
];

const report = [];
const items = new Map();
for (const s of sources) {
  try {
    const found = (await s.run()).filter(Boolean);
    found.forEach((o) => items.set(o.url || o.id, o));
    const prev = report.find((r) => r.name === s.name);
    if (prev) { prev.count += found.length; prev.ok ||= true; } else report.push({ name: s.name, ok: true, count: found.length });
    console.log(`✓ ${s.name}: ${found.length}`);
  } catch (e) {
    if (!report.find((r) => r.name === s.name)) report.push({ name: s.name, ok: false, count: 0, error: String(e.message).slice(0, 200) });
    console.warn(`✕ ${s.name}: ${e.message}`);
  }
}

const now = new Date().toISOString();
const list = [...items.values()]
  .filter((o) => !o.deadline || o.deadline >= now.slice(0, 10))
  .sort((a, b) => (b.published ?? '').localeCompare(a.published ?? ''))
  .slice(0, 400);
await mkdir(dirname(out), { recursive: true }).catch(() => {});
await writeFile(out, JSON.stringify({ generatedAt: now, sources: report, items: list }, null, 1));
console.log(`Wrote ${list.length} opportunities to ${out}`);
