// Plain-English definitions shown wherever these terms appear.
export const GLOSSARY = {
  soFar: { term: 'So far this year', text: 'Income from 6 April (the start of the tax year) up to today, compared with the same stretch of last year: 6 April to the same date. A like-for-like check on how this year is going.' },
  runRate: { term: 'Run rate', text: 'Total income over the last 12 complete months. It rolls forward every month, so it shows what the business is earning per year right now, without waiting for the tax year to end. If it’s rising, the business is growing.' },
  last3: { term: 'Last 3 months', text: 'Income in the three most recent complete months, compared with the same three months a year earlier. Comparing the same months strips out seasonal ups and downs.' },
  momentum: { term: 'Momentum', text: 'The last 3 complete months compared with the 3 months before them. It shows the short-term direction, but can be skewed by seasonal patterns, so read it alongside Seasonality.' },
  pace: { term: 'Pace', text: 'A running total from 6 April. Each line climbs as money comes in; if this year’s line is above last year’s at the same month, you’re ahead of last year.' },
  seasonality: { term: 'Seasonality', text: 'How income usually spreads across the year. A quiet month is one that typically brings in under 60% of an average month; a busy one brings in over 140%. It needs at least two full tax years of records to be reliable.' },
  received: { term: 'Money received', text: 'Counts income on the date the payment reached your account, matching your Starling statements. This is also how sole traders are taxed by default (cash basis).' },
  invoiced: { term: 'Work invoiced', text: 'Counts income on the date the invoice was raised. Closer to when you were actually doing the work, so better for spotting busy and quiet periods.' },
  taxYear: { term: 'Tax year', text: 'The UK tax year runs from 6 April to 5 April. “2026/27” means 6 April 2026 to 5 April 2027.' },
  partial: { term: 'Partial records', text: 'Your records in Lede start part-way through this year, so its total is incomplete. It isn’t used for growth comparisons or seasonality.' },
  avgInvoice: { term: 'Average invoice', text: 'Total invoiced in the year divided by the number of invoices. Rising means bigger projects or better rates.' },
  newClients: { term: 'New clients', text: 'Clients whose first-ever invoice was in that year.' },
  profit: { term: 'Profit', text: 'Income less the expenses recorded in Lede, before tax.' },
  weighted: { term: 'Weighted pipeline', text: 'Each opportunity’s value multiplied by how likely it is to happen, added up. A £10,000 job at 50% counts as £5,000. A realistic view of what the pipeline is worth.' },
  setAside: { term: 'Set aside for tax', text: 'Estimated income tax and Class 4 National Insurance for the year, divided by 12. Moving this into a separate pot each month means the January and July tax bills aren’t a shock.' },
  band: { term: 'Tax band', text: 'Which income tax rate applies to your top slice of income: 20% basic rate up to £50,270, 40% higher rate above that, with the personal allowance shrinking between £100,000 and £125,140.' },
  classFour: { term: 'Class 4 NI', text: 'National Insurance for the self-employed: 6% of profits between £12,570 and £50,270, and 2% above that. Paid with your Self Assessment bill.' },
  tradingAllowance: { term: 'Trading allowance', text: 'Instead of claiming actual expenses, sole traders can deduct a flat £1,000. Lede uses whichever is larger.' },
} as const;
export type GlossaryKey = keyof typeof GLOSSARY;
