import { Lead, validateLead } from './validator';
import * as apiClient from './apiClient';
import { createLogger } from './logger';

const logger = createLogger('leadProcessor');

export type LeadAction = 'created' | 'updated' | 'skipped' | 'error';

export interface LeadResult {
  email: string;
  action: LeadAction;
  details?: string;
  errors?: string[];
  lead: Lead;
}

export interface ProcessingSummary {
  total: number;
  created: number;
  updated: number;
  skipped: number;
  errors: number;
}

export interface ProcessResult {
  results: LeadResult[];
  summary: ProcessingSummary;
}

/**
 * Extracts error message from unknown error
 */
const getErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : 'Unknown error';

/**
 * Checks if two leads have identical data
 */
const leadsAreIdentical = (lead1: Lead, lead2: Lead): boolean =>
  ['name', 'email', 'company', 'source'].every(
    (key) => lead1[key as keyof Lead] === lead2[key as keyof Lead]
  );

/**
 * Creates a LeadResult object
 */
const createResult = (
  lead: Lead,
  action: LeadAction,
  details: string,
  errors?: string[]
): LeadResult => ({
  email: lead.email,
  action,
  details,
  lead,
  ...(errors && { errors }),
});

/**
 * Process a single lead against the API
 */
async function processOneLead(
  lead: Lead,
  processedEmails: Set<string>
): Promise<LeadResult> {
  // Step 1: Validate lead
  const validation = validateLead(lead);
  if (!validation.isValid) {
    logger.warn('Invalid lead', { email: lead.email, errors: validation.errors });
    return createResult(lead, 'error', 'Validation failed', validation.errors);
  }

  // Step 2: Check for duplicate email in batch
  const emailLower = lead.email.toLowerCase();
  if (processedEmails.has(emailLower)) {
    logger.warn('Duplicate email in batch', { email: lead.email });
    return createResult(lead, 'skipped', 'Duplicate email in batch', ['Duplicate email in batch']);
  }
  processedEmails.add(emailLower);

  // Step 3: Lookup existing lead
  let existingLead: Lead | null;
  try {
    existingLead = await apiClient.lookup(lead.email);
  } catch (error) {
    const msg = getErrorMessage(error);
    logger.error('API lookup failed', { email: lead.email, error: msg });
    return createResult(lead, 'error', 'API lookup failed', [msg]);
  }

  // Step 4: Handle based on lookup result
  return existingLead
    ? await handleExistingLead(lead, existingLead)
    : await handleNewLead(lead);
}

/**
 * Handle lead that already exists in API
 */
async function handleExistingLead(lead: Lead, existingLead: Lead): Promise<LeadResult> {
  if (leadsAreIdentical(existingLead, lead)) {
    logger.info('Lead unchanged, skipping', { email: lead.email });
    return createResult(lead, 'skipped', 'Lead data identical');
  }

  try {
    await apiClient.update(lead);
    logger.info('Lead updated', { email: lead.email });
    return createResult(lead, 'updated', 'Lead updated successfully');
  } catch (error) {
    const msg = getErrorMessage(error);
    logger.error('API update failed', { email: lead.email, error: msg });
    return createResult(lead, 'error', 'API update failed', [msg]);
  }
}

/**
 * Handle new lead (not in API)
 */
async function handleNewLead(lead: Lead): Promise<LeadResult> {
  try {
    await apiClient.create(lead);
    logger.info('Lead created', { email: lead.email });
    return createResult(lead, 'created', 'Lead created successfully');
  } catch (error) {
    const msg = getErrorMessage(error);
    logger.error('API create failed', { email: lead.email, error: msg });
    return createResult(lead, 'error', 'API create failed', [msg]);
  }
}

/**
 * Calculate summary from results
 */
const calculateSummary = (results: LeadResult[]): ProcessingSummary => ({
  total: results.length,
  created: results.filter((r) => r.action === 'created').length,
  updated: results.filter((r) => r.action === 'updated').length,
  skipped: results.filter((r) => r.action === 'skipped').length,
  errors: results.filter((r) => r.action === 'error').length,
});

/**
 * Process a batch of leads
 */
export async function processLeads(leads: Lead[]): Promise<ProcessResult> {
  const processedEmails = new Set<string>();
  const results: LeadResult[] = [];

  for (const lead of leads) {
    try {
      const result = await processOneLead(lead, processedEmails);
      results.push(result);
    } catch (error) {
      const msg = getErrorMessage(error);
      logger.error('Unexpected error processing lead', { email: lead.email, error: msg });
      results.push(createResult(lead, 'error', 'Unexpected error', [msg]));
    }
  }

  const summary = calculateSummary(results);
  logger.info('Processing complete', summary);

  return { results, summary };
}
