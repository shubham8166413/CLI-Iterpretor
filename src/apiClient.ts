import axios from "axios";
import { Lead } from "./validator";
import { createLogger } from "./logger";

const logger = createLogger("apiClient");

const BASE_URL = process.env.API_BASE_URL || "http://localhost:3001";
const MAX_RETRIES = 3;
const BASE_DELAY = process.env.NODE_ENV === "test" ? 0 : 1000;

const RETRYABLE_STATUS_CODES = [429, 500, 502, 503, 504];
const RETRYABLE_ERROR_CODES = ["ECONNABORTED", "ETIMEDOUT"];

function isRetryable(err: unknown): boolean {
  const error = err as {
    isAxiosError?: boolean;
    response?: { status?: number };
    code?: string;
  };

  if (error.code && RETRYABLE_ERROR_CODES.includes(error.code)) {
    return true;
  }

  if (
    error.response?.status &&
    RETRYABLE_STATUS_CODES.includes(error.response.status)
  ) {
    return true;
  }

  return false;
}

async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await fn();
    } catch (err: unknown) {
      lastError = err;

      if (!isRetryable(err)) {
        throw err;
      }

      logger.warn("Request failed, will retry", {
        attempt,
        maxRetries: MAX_RETRIES,
        status: (err as { response?: { status?: number } }).response?.status,
        code: (err as { code?: string }).code,
      });

      if (attempt === MAX_RETRIES) {
        break;
      }

      const delay = BASE_DELAY * Math.pow(2, attempt - 1);
      logger.info(`Waiting ${delay}ms before retry ${attempt + 1}/${MAX_RETRIES}`);

      if (delay > 0) {
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  throw new Error(
    `Max retries exhausted after ${MAX_RETRIES} attempts. Last error: ${
      lastError instanceof Error ? lastError.message : String(lastError)
    }`
  );
}

function extractLeadFromResponse(data: unknown): Lead {
  if (data == null || typeof data !== "object") {
    throw new Error(
      "Malformed API response: missing expected fields (name, email)"
    );
  }

  const record = data as Record<string, unknown>;

  // Unwrap nested lead: { success: true, lead: {...} } or { found: true, lead: {...} }
  const leadData = (
    record.lead && typeof record.lead === "object" ? record.lead : data
  ) as Record<string, unknown>;

  if (!("name" in leadData) || !("email" in leadData)) {
    throw new Error(
      "Malformed API response: missing expected fields (name, email)"
    );
  }

  return {
    name: String(leadData.name),
    email: String(leadData.email),
    company: String(leadData.company ?? ""),
    source: String(leadData.source ?? ""),
  };
}

// Keep for unit tests that mock axios with flat lead objects
function validateLeadResponse(data: unknown): Lead {
  if (data == null || typeof data !== "object") {
    throw new Error(
      "Malformed API response: missing expected fields (name, email)"
    );
  }

  // If it has a nested lead property, extract from there
  const record = data as Record<string, unknown>;
  if (record.lead && typeof record.lead === "object") {
    return extractLeadFromResponse(data);
  }

  // Flat response (from unit test mocks)
  if (!("name" in record) || !("email" in record)) {
    throw new Error(
      "Malformed API response: missing expected fields (name, email)"
    );
  }

  return data as Lead;
}

export async function lookupLead(email: string): Promise<Lead | null> {
  return withRetry(async () => {
    try {
      logger.debug("Looking up lead", { email });

      const response = await axios.get(`${BASE_URL}/api/leads/lookup`, {
        params: { email },
      });

      const data = response.data as Record<string, unknown>;

      // Server returns { found: false } for non-existent leads (200, not 404)
      if ("found" in data && data.found === false) {
        logger.debug("Lead not found", { email });
        return null;
      }

      // Server returns { found: true, lead: {...} }
      const lead = validateLeadResponse(data);
      logger.debug("Lead found", { email });
      return lead;
    } catch (err: unknown) {
      const error = err as {
        isAxiosError?: boolean;
        response?: { status?: number };
      };

      if (error.isAxiosError && error.response?.status === 404) {
        return null;
      }

      throw err;
    }
  });
}

export async function createLead(lead: Lead): Promise<Lead> {
  return withRetry(async () => {
    logger.debug("Creating lead", { email: lead.email });

    const response = await axios.post(`${BASE_URL}/api/leads/create`, lead);

    // Server returns { success: true, lead: {...} }
    const created = validateLeadResponse(response.data);
    logger.debug("Lead created", { email: lead.email });
    return created;
  });
}

export async function updateLead(lead: Lead): Promise<Lead> {
  return withRetry(async () => {
    logger.debug("Updating lead", { email: lead.email });

    const response = await axios.post(`${BASE_URL}/api/leads/update`, lead);

    // Server returns { success: true, lead: {...} }
    const updated = validateLeadResponse(response.data);
    logger.debug("Lead updated", { email: lead.email });
    return updated;
  });
}