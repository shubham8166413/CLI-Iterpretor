import { Lead, validateLead, normalizeCompany } from "./validator";
import { lookupLead, createLead, updateLead } from "./apiClient";
import { createLogger } from "./logger";

const logger = createLogger("leadProcessor");

export interface ProcessResult {
  lead: Lead;
  action: "created" | "updated" | "skipped" | "error";
  error?: string;
}

export interface ProcessSummary {
  total: number;
  created: number;
  updated: number;
  skipped: number;
  errors: number;
}

export interface ProcessOutput {
  results: ProcessResult[];
  summary: ProcessSummary;
}

function leadsMatch(incoming: Lead, existing: Lead): boolean {
  return (
    incoming.name === existing.name &&
    incoming.email.toLowerCase() === existing.email.toLowerCase() &&
    normalizeCompany(incoming.company) === normalizeCompany(existing.company) &&
    incoming.source === existing.source
  );
}

export async function processLeads(leads: Lead[]): Promise<ProcessOutput> {
  const results: ProcessResult[] = [];
  const seenEmails = new Set<string>();

  for (const lead of leads) {
    // 1. Validate
    const validation = validateLead(lead);
    if (!validation.isValid) {
      logger.warn("Invalid lead, skipping", {
        email: lead.email,
        errors: validation.errors,
      });
      results.push({
        lead,
        action: "error",
        error: validation.errors.join("; "),
      });
      continue;
    }

    // 2. Duplicate check within batch
    const emailKey = lead.email.toLowerCase();
    if (seenEmails.has(emailKey)) {
      logger.warn("Duplicate email in batch, skipping", {
        email: lead.email,
      });
      results.push({
        lead,
        action: "skipped",
      });
      continue;
    }
    seenEmails.add(emailKey);

    // 3–7. API operations with try-catch per lead
    try {
      const existing = await lookupLead(lead.email);

      if (existing) {
        if (!leadsMatch(lead, existing)) {
          await updateLead(lead);
          logger.info("Lead updated", { email: lead.email });
          results.push({ lead, action: "updated" });
        } else {
          logger.info("Lead unchanged, skipping", { email: lead.email });
          results.push({ lead, action: "skipped" });
        }
      } else {
        await createLead(lead);
        logger.info("Lead created", { email: lead.email });
        results.push({ lead, action: "created" });
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);

      // Handle 409 conflict — lead was created between lookup and create
      const axiosErr = err as { response?: { status?: number } };
      if (axiosErr.response?.status === 409) {
        logger.info("Lead already exists (conflict), skipping", {
          email: lead.email,
        });
        results.push({ lead, action: "skipped" });
        continue;
      }

      logger.error("API error processing lead", {
        email: lead.email,
        error: message,
      });
      results.push({
        lead,
        action: "error",
        error: message,
      });
    }
  }

  const summary: ProcessSummary = {
    total: results.length,
    created: results.filter((r) => r.action === "created").length,
    updated: results.filter((r) => r.action === "updated").length,
    skipped: results.filter((r) => r.action === "skipped").length,
    errors: results.filter((r) => r.action === "error").length,
  };

  logger.info("Processing complete", { summary });

  return { results, summary };
}