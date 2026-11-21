export type ISODate = string; // yyyy-mm-dd

export type Sector = 'Charity / NFP' | 'Public sector' | 'Education' | 'Health' | 'Private' | 'Agency' | 'Other';

export interface Client {
  id: string;
  name: string;
  sector: Sector;
  contactName?: string;
  email?: string;
  phone?: string;
  notes?: string;
  lastContacted?: ISODate;
  nextFollowUp?: ISODate;
  createdAt: ISODate;
}

export interface Invoice {
  id: string;
  number: string;
  clientId: string;
  description: string;
  issueDate: ISODate;
  dueDate: ISODate;
  amount: number; // GBP, net
  paidDate?: ISODate;
  /** Pitch material: flag notable work */
  bankRef?: string; // set when created/reconciled from a bank statement
  showcase?: boolean;
  profile?: number; // 1–5 how high-profile / exciting
  highlight?: string; // one-line case-study blurb
}

export interface Expense {
  id: string;
  date: ISODate;
  description: string;
  category: ExpenseCategory;
  amount: number;
  bankRef?: string;
}
export type ExpenseCategory =
  | 'Travel' | 'Mileage' | 'Software & subscriptions' | 'Phone & internet' | 'Office & equipment'
  | 'Training & CPD' | 'Professional fees' | 'Marketing' | 'Use of home' | 'Other';

export type Stage = 'Lead' | 'In conversation' | 'Proposal sent' | 'Negotiating' | 'Won' | 'Lost';

export interface Deal {
  id: string;
  title: string;
  clientId?: string;
  clientName?: string; // for prospects not yet in the register
  value: number;
  probability: number; // 0–100
  stage: Stage;
  source?: string;
  link?: string;
  expectedStart?: ISODate;
  lastActivity: ISODate;
  nextAction?: string;
  notes?: string;
  createdAt: ISODate;
}

export interface Doc {
  id: string;
  name: string;
  kind: 'CV' | 'Credentials' | 'Case study' | 'Proposal template' | 'Other';
  mime: string;
  size: number;
  data: string; // base64
  updatedAt: ISODate;
  notes?: string;
}

export interface Profile {
  headline: string;
  bio: string;
  skills: string;
  sectors: string;
  experience: string; // free text, one role per paragraph
  education: string;
}

export interface TaxParams {
  personalAllowance: number;
  taperThreshold: number;
  basicBand: number; // width of basic-rate band
  additionalThreshold: number;
  basicRate: number;
  higherRate: number;
  additionalRate: number;
  niLower: number;
  niUpper: number;
  niMainRate: number;
  niUpperRate: number;
  vatThreshold: number;
}

export interface Settings {
  businessName: string;
  ownerName: string;
  email: string;
  phone: string;
  address: string;
  website: string;
  bankDetails: string;
  invoicePrefix: string;
  nextInvoiceNumber: number;
  paymentTermsDays: number;
  basis: 'cash' | 'accruals';
  otherIncome: number; // e.g. PAYE salary, for banding
  taxPot: number; // amount already set aside this tax year
  projection: 'runrate' | 'pipeline';
  staleDays: number;
  autoLockMinutes: number;
  keywords: string;
  googleClientId: string;
  driveSync: boolean;
  bankManaged: boolean; // invoicing & MTD filing handled by her bank (Starling)
  bankRules: Record<string, BankRule>; // remembered per counterparty
  tax: TaxParams;
}

export type BankRule =
  | { kind: 'client'; clientId: string }
  | { kind: 'ignore' }
  | { kind: 'expense'; category: ExpenseCategory };

export interface Vault {
  version: 1;
  updatedAt: string;
  settings: Settings;
  clients: Client[];
  invoices: Invoice[];
  expenses: Expense[];
  deals: Deal[];
  docs: Doc[];
  profile: Profile;
  dismissedOpps: string[];
}

export interface Opportunity {
  id: string;
  title: string;
  buyer?: string;
  description?: string;
  value?: number;
  deadline?: string;
  published?: string;
  url: string;
  source: string;
  location?: string;
}
