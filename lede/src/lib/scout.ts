import type { Opportunity } from './types';

export const NFP_RE = /\b(charit(y|ies|able)|trust|foundation|nhs|council|borough|county|universit|college|school|housing association|cic|community|not[- ]for[- ]profit|non[- ]profit|third sector|voluntary|social enterprise|hospice|museum|arts|heritage|ngo|public health|combined authority|police|fire and rescue)\b/i;

export function scoreOpp(o: Opportunity, keywords: string): { score: number; nfp: boolean; hits: string[] } {
  const kws = keywords.split(',').map((k) => k.trim().toLowerCase()).filter(Boolean);
  const title = o.title.toLowerCase();
  const body = `${o.description ?? ''} ${o.buyer ?? ''}`.toLowerCase();
  const hits: string[] = [];
  let raw = 0;
  for (const k of kws) {
    const re = new RegExp(`\\b${k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i');
    if (re.test(title)) { raw += 3; hits.push(k); } else if (re.test(body)) { raw += 1; hits.push(k); }
  }
  const nfp = NFP_RE.test(`${o.buyer ?? ''} ${o.title} ${o.description ?? ''}`);
  if (nfp) raw += 2;
  if (/freelance|consultan|contract|interim|tender|framework/i.test(o.title)) raw += 1;
  return { score: Math.min(100, Math.round((raw / 10) * 100)), nfp, hits };
}

export function quickSearches(term: string) {
  const t = encodeURIComponent(term);
  const plus = term.trim().replace(/\s+/g, '+');
  return [
    { name: 'CharityJob', note: 'UK charity roles & freelance', url: `https://www.charityjob.co.uk/jobs?keywords=${plus}` },
    { name: 'CharityComms', note: 'Charity comms jobs board', url: 'https://www.charitycomms.org.uk/jobs' },
    { name: 'Guardian Jobs', note: 'Charity, media & public sector', url: `https://jobs.theguardian.com/jobs/?Keywords=${plus}` },
    { name: 'Third Sector Jobs', note: 'Voluntary sector', url: `https://jobs.thirdsector.co.uk/jobs/?keywords=${plus}` },
    { name: 'Contracts Finder', note: 'UK public contracts under £139k', url: 'https://www.contractsfinder.service.gov.uk/Search' },
    { name: 'Find a Tender', note: 'Larger public contracts', url: `https://www.find-tender.service.gov.uk/Search/Results?keywords=${t}` },
    { name: 'LinkedIn', note: 'Contract & freelance roles', url: `https://www.linkedin.com/jobs/search/?keywords=${t}&location=United%20Kingdom&f_JT=C%2CT` },
    { name: 'Escape the City', note: 'Purpose-driven work', url: `https://www.escapethecity.org/search/jobs?q=${t}` },
    { name: 'Indeed', note: 'Contract roles UK-wide', url: `https://uk.indeed.com/jobs?q=${t}&sc=0kf%3Ajt%28contract%29%3B` },
    { name: 'Upwork', note: 'Remote freelance briefs', url: `https://www.upwork.com/nx/search/jobs/?q=${t}` },
  ];
}
