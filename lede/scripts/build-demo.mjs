// Builds the click-through demo (fictional data, no service worker) into dist-demo/.
import { execSync } from 'node:child_process';
import { readdirSync, writeFileSync } from 'node:fs';
execSync('npx vite build', { stdio: 'inherit', env: { ...process.env, VITE_DEMO: '1' } });
const d = (n) => new Date(Date.now() + n * 864e5).toISOString();
const items = [
  ['Communications and engagement support for a public consultation', 'A city council (sample)', 'Freelance communications consultant to plan and deliver resident engagement for a borough-wide consultation.', 24000, 24, 'Contracts Finder (sample)', 'https://www.contractsfinder.service.gov.uk/Search'],
  ['Framework for PR and media relations services', 'A regional arts body (sample)', 'PR, media relations and campaign communications framework, multiple lots.', 90000, 35, 'Find a Tender (sample)', 'https://www.find-tender.service.gov.uk/Search'],
  ['Freelance copywriter: annual impact report', "A national children's charity (sample)", 'Freelance copywriter to write and edit our annual impact report and supporter storytelling.', undefined, 12, 'CharityJob (sample)', 'https://www.charityjob.co.uk/'],
  ['Interim Head of Communications (6-month contract)', 'A hospice trust (sample)', 'Interim comms lead covering strategy, internal comms and media.', undefined, 18, 'Guardian Jobs (sample)', 'https://jobs.theguardian.com/'],
  ['Campaign messaging and brand storytelling', 'A housing association (sample)', 'Messaging framework and storytelling for a tenant campaign.', 15000, 30, 'Contracts Finder (sample)', 'https://www.contractsfinder.service.gov.uk/Search'],
  ['Behaviour change communications for public health campaign', 'An NHS integrated care board (sample)', 'Strategy and content for a winter public health campaign.', 40000, 21, 'Find a Tender (sample)', 'https://www.find-tender.service.gov.uk/Search'],
  ['Digital content writer (freelance, 2 days/week)', 'A university (sample)', 'Web and social content writing for student recruitment.', undefined, 9, 'Third Sector Jobs (sample)', 'https://jobs.thirdsector.co.uk/'],
  ['Marketing services for product launch', 'A retail company (sample)', 'Marketing agency services.', 8000, 14, 'Contracts Finder (sample)', 'https://www.contractsfinder.service.gov.uk/Search'],
].map(([title, buyer, description, value, days, source, url], i) => ({ id: 'demo-' + i, title, buyer, description, value, deadline: d(days), published: d(-i - 1), url: `${url}#demo-${i}`, source }));
writeFileSync('dist-demo/opportunities.json', JSON.stringify({ generatedAt: new Date().toISOString(), sources: [{ name: 'Sample feed', ok: true, count: items.length }], items }));
const a = readdirSync('dist-demo/assets');
const js = a.find((f) => /^index-.*\.js$/.test(f)), css = a.find((f) => /^index-.*\.css$/.test(f));
writeFileSync('dist-demo/lede-demo.html', `<title>Lede Demo</title>\n<meta name="robots" content="noindex, nofollow" />\n<meta name="theme-color" content="#f6f1ec" />\n<link rel="stylesheet" href="./assets/${css}">\n<div id="root"></div>\n<script type="module" src="./assets/${js}"></script>\n`);
console.log(JSON.stringify(Object.fromEntries([...a.map((f) => [`assets/${f}`, `assets/${f}`]), ['opportunities.json', 'opportunities.json']])));
