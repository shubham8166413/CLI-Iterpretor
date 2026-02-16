export const VALID_SOURCES = [
    "LinkedIn",
    "Webinar",
    "Conference",
    "Referral",
    "Twitter",
    "Website",
  ] as const;
  
  export interface Lead {
    name: string;
    email: string;
    company: string;
    source: string;
  }
  
  export interface ValidationResult {
    isValid: boolean;
    errors: string[];
  }
  
  const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  
  export function normalizeCompany(company: string): string {
    return company.trim().replace(/\s+/g, " ");
  }
  
  export function validateLead(lead: Lead): ValidationResult {
    const errors: string[] = [];
  
    if (!lead.name || lead.name.trim() === "") {
      errors.push("Name is required");
    }
  
    if (!lead.email || !EMAIL_REGEX.test(lead.email)) {
      errors.push("Invalid email format");
    }
  
    const normalizedCompany = normalizeCompany(lead.company ?? "");
    if (normalizedCompany === "") {
      errors.push("Company is required");
    }
  
    if (!lead.source || lead.source.trim() === "") {
      errors.push("Source is required");
    } else if (!VALID_SOURCES.includes(lead.source as (typeof VALID_SOURCES)[number])) {
      errors.push("Invalid source");
    }
  
    return {
      isValid: errors.length === 0,
      errors,
    };
  }
  
  export function detectDuplicateEmails(leads: Lead[]): Map<string, number[]> {
    const emailIndices = new Map<string, number[]>();
  
    leads.forEach((lead, index) => {
      const email = lead.email.toLowerCase();
      const indices = emailIndices.get(email);
      if (indices) {
        indices.push(index);
      } else {
        emailIndices.set(email, [index]);
      }
    });
  
    const duplicates = new Map<string, number[]>();
    for (const [email, indices] of emailIndices) {
      if (indices.length > 1) {
        duplicates.set(email, indices);
      }
    }
  
    return duplicates;
  }