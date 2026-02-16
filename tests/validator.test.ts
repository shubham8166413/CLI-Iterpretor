import {
    validateLead,
    detectDuplicateEmails,
    Lead,
  } from "../src/validator";
  
  function validLead(overrides: Partial<Lead> = {}): Lead {
    return {
      name: "Jane Doe",
      email: "jane@example.com",
      company: "Acme Corp",
      source: "LinkedIn",
      ...overrides,
    };
  }
  
  describe("validateLead", () => {
    it("returns isValid true and empty errors for a valid lead", () => {
      const result = validateLead(validLead());
      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
    });
  
    describe("email validation", () => {
      it('returns "Invalid email format" when email has no @', () => {
        const result = validateLead(validLead({ email: "janeatexample.com" }));
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain("Invalid email format");
      });
  
      it("returns invalid email when email contains spaces", () => {
        const result = validateLead(validLead({ email: "jane @example.com" }));
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain("Invalid email format");
      });
  
      it("returns invalid email for leading space", () => {
        const result = validateLead(validLead({ email: " jane@example.com" }));
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain("Invalid email format");
      });
  
      it("returns invalid email for trailing space", () => {
        const result = validateLead(validLead({ email: "jane@example.com " }));
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain("Invalid email format");
      });
    });
  
    describe("required fields", () => {
      it('returns "Name is required" when name is empty string', () => {
        const result = validateLead(validLead({ name: "" }));
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain("Name is required");
      });
  
      it('returns "Name is required" when name is only whitespace', () => {
        const result = validateLead(validLead({ name: "   " }));
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain("Name is required");
      });
  
      it('returns "Company is required" when company is empty string', () => {
        const result = validateLead(validLead({ company: "" }));
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain("Company is required");
      });
  
      it('returns "Company is required" when company is only whitespace', () => {
        const result = validateLead(validLead({ company: "   " }));
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain("Company is required");
      });
  
      it('returns "Source is required" when source is empty string', () => {
        const result = validateLead(validLead({ source: "" }));
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain("Source is required");
      });
    });
  
    describe("source allowlist", () => {
      it.each(["LinkedIn", "Webinar", "Conference", "Referral", "Twitter", "Website"])(
        "accepts %s as a valid source",
        (source) => {
          const result = validateLead(validLead({ source }));
          expect(result.isValid).toBe(true);
          expect(result.errors).toEqual([]);
        }
      );
  
      it("rejects a source not in the allowlist", () => {
        const result = validateLead(validLead({ source: "TikTok" }));
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain("Invalid source");
      });
    });
  
    describe("multiple errors", () => {
      it("collects multiple errors at once for missing name and invalid email", () => {
        const result = validateLead(validLead({ name: "", email: "bademail" }));
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain("Name is required");
        expect(result.errors).toContain("Invalid email format");
        expect(result.errors).toHaveLength(2);
      });
  
      it("collects all errors when every field is invalid", () => {
        const result = validateLead({
          name: "",
          email: "nope",
          company: "",
          source: "Unknown",
        });
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain("Name is required");
        expect(result.errors).toContain("Invalid email format");
        expect(result.errors).toContain("Company is required");
        expect(result.errors).toContain("Invalid source");
        expect(result.errors).toHaveLength(4);
      });
    });
  
    describe("company normalization", () => {
      it("trims leading and trailing whitespace from company", () => {
        const result = validateLead(validLead({ company: "  Acme Corp  " }));
        expect(result.isValid).toBe(true);
        expect(result.errors).toEqual([]);
      });
  
      it("collapses multiple internal spaces in company name", () => {
        const result = validateLead(validLead({ company: "Acme   Corp   Inc" }));
        expect(result.isValid).toBe(true);
        expect(result.errors).toEqual([]);
      });
  
      it("does not treat whitespace-only company as valid after trimming", () => {
        const result = validateLead(validLead({ company: "    " }));
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain("Company is required");
      });
    });
  });
  
  describe("detectDuplicateEmails", () => {
    it("returns a map of email to row indices for duplicate emails", () => {
      const leads: Lead[] = [
        validLead({ email: "dupe@example.com" }),
        validLead({ email: "unique@example.com" }),
        validLead({ email: "dupe@example.com" }),
      ];
  
      const result = detectDuplicateEmails(leads);
  
      expect(result).toBeInstanceOf(Map);
      expect(result.get("dupe@example.com")).toEqual([0, 2]);
    });
  
    it("does not include non-duplicate emails in the map", () => {
      const leads: Lead[] = [
        validLead({ email: "dupe@example.com" }),
        validLead({ email: "unique@example.com" }),
        validLead({ email: "dupe@example.com" }),
      ];
  
      const result = detectDuplicateEmails(leads);
  
      expect(result.has("unique@example.com")).toBe(false);
    });
  
    it("returns an empty map when there are no duplicates", () => {
      const leads: Lead[] = [
        validLead({ email: "a@example.com" }),
        validLead({ email: "b@example.com" }),
        validLead({ email: "c@example.com" }),
      ];
  
      const result = detectDuplicateEmails(leads);
  
      expect(result.size).toBe(0);
    });
  
    it("handles case-insensitive email comparison", () => {
      const leads: Lead[] = [
        validLead({ email: "Jane@Example.com" }),
        validLead({ email: "jane@example.com" }),
      ];
  
      const result = detectDuplicateEmails(leads);
  
      expect(result.size).toBe(1);
      expect(result.get("jane@example.com")).toEqual([0, 1]);
    });
  
    it("tracks multiple sets of duplicates independently", () => {
      const leads: Lead[] = [
        validLead({ email: "a@test.com" }),
        validLead({ email: "b@test.com" }),
        validLead({ email: "a@test.com" }),
        validLead({ email: "b@test.com" }),
        validLead({ email: "c@test.com" }),
      ];
  
      const result = detectDuplicateEmails(leads);
  
      expect(result.size).toBe(2);
      expect(result.get("a@test.com")).toEqual([0, 2]);
      expect(result.get("b@test.com")).toEqual([1, 3]);
      expect(result.has("c@test.com")).toBe(false);
    });
  
    it("returns an empty map for an empty array", () => {
      const result = detectDuplicateEmails([]);
      expect(result.size).toBe(0);
    });
  });