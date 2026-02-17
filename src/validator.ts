export interface Lead {
  name: string;
  email: string;
  company: string;
  source: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  normalizedLead?: Lead;
}

export const VALID_SOURCES = [
  'LinkedIn',
  'Webinar',
  'Website',
  'Conference',
  'Referral',
  'Twitter',
] as const;

export type ValidSource = typeof VALID_SOURCES[number];

// Strong email regex - no spaces, requires @, proper format
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const normalizeCompany = (company: string): string =>
  company.trim().replace(/\s+/g, ' ');

const isEmpty = (value: string | undefined): boolean =>
  !value || value.trim() === '';

export function validateLead(lead: Lead): ValidationResult {
  const errors: string[] = [];

  // Validate required fields
  if (isEmpty(lead.name)) errors.push('Name is required');
  if (isEmpty(lead.company)) errors.push('Company is required');
  
  // Validate email format
  if (!lead.email || !EMAIL_REGEX.test(lead.email)) {
    errors.push('Invalid email format');
  }

  // Validate source
  if (isEmpty(lead.source)) {
    errors.push('Source is required');
  } else if (!VALID_SOURCES.includes(lead.source as ValidSource)) {
    errors.push(`Source must be one of: ${VALID_SOURCES.join(', ')}`);
  }

  const isValid = errors.length === 0;

  return {
    isValid,
    errors,
    ...(isValid && {
      normalizedLead: { ...lead, company: normalizeCompany(lead.company) },
    }),
  };
}

export function detectDuplicateEmails(leads: Lead[]): Map<string, number[]> {
  const emailIndices = new Map<string, number[]>();

  // Collect all indices for each email
  leads.forEach((lead, index) => {
    const email = lead.email.toLowerCase();
    const indices = emailIndices.get(email) ?? [];
    indices.push(index);
    emailIndices.set(email, indices);
  });

  // Filter to only duplicates (more than 1 occurrence)
  return new Map(
    [...emailIndices].filter(([, indices]) => indices.length > 1)
  );
}
