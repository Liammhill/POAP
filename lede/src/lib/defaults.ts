import { DEFAULT_TAX } from './tax';
import type { Vault } from './types';

export function emptyVault(): Vault {
  return {
    version: 1,
    updatedAt: new Date().toISOString(),
    settings: {
      businessName: 'Eleanor Herzog Communications',
      ownerName: 'Eleanor Herzog',
      email: '',
      phone: '',
      address: '',
      website: '',
      bankDetails: '',
      invoicePrefix: 'EH-',
      nextInvoiceNumber: 1,
      paymentTermsDays: 30,
      basis: 'cash',
      otherIncome: 0,
      taxPot: 0,
      projection: 'runrate',
      staleDays: 21,
      autoLockMinutes: 10,
      keywords:
        'communications, comms, copywriting, copywriter, content, campaign, strategy, messaging, stakeholder engagement, public relations, PR, press, media relations, brand, storytelling, editorial, impact report, annual report, consultation, engagement, marketing, digital content, writer, freelance, consultant',
      googleClientId: '',
      driveSync: false,
      bankManaged: true,
      bankRules: {},
      tax: { ...DEFAULT_TAX },
    },
    clients: [],
    invoices: [],
    expenses: [],
    deals: [],
    docs: [],
    profile: {
      headline: 'Communications strategist & consultant',
      bio: 'I help purpose-driven organisations say what they mean — clearly, credibly and with impact. From campaign strategy to the words on the page, I work with charities, public bodies and social enterprises to sharpen their story and reach the people who matter.',
      skills: 'Communications strategy, Campaign planning, Copywriting & editing, Stakeholder engagement, Media relations, Impact & annual reports, Messaging frameworks, Training & workshops',
      sectors: 'Charity & not-for-profit, Public sector, Health, Arts & culture, Social enterprise',
      experience: '',
      education: '',
    },
    dismissedOpps: [],
  };
}

/** Fill in any fields added in later versions. */
export function migrate(v: Vault): Vault {
  const base = emptyVault();
  return {
    ...base,
    ...v,
    settings: { ...base.settings, ...v.settings, tax: { ...base.settings.tax, ...(v.settings?.tax ?? {}) } },
    profile: { ...base.profile, ...v.profile },
  };
}
