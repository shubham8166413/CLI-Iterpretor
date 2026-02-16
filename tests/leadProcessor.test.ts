import { processLeads, ProcessResult, ProcessSummary } from "../src/leadProcessor";
import { Lead } from "../src/validator";
import * as apiClient from "../src/apiClient";

jest.mock("../src/apiClient");

const mockedApiClient = apiClient as jest.Mocked<typeof apiClient>;

function mockLead(overrides: Partial<Lead> = {}): Lead {
  return {
    name: "Jane Doe",
    email: "jane@example.com",
    company: "Acme Corp",
    source: "LinkedIn",
    ...overrides,
  };
}

describe("leadProcessor", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("new lead", () => {
    it("calls create when lookup returns null and returns action='created'", async () => {
      const lead = mockLead();
      mockedApiClient.lookupLead.mockResolvedValueOnce(null);
      mockedApiClient.createLead.mockResolvedValueOnce(lead);

      const { results } = await processLeads([lead]);

      expect(mockedApiClient.lookupLead).toHaveBeenCalledWith("jane@example.com");
      expect(mockedApiClient.createLead).toHaveBeenCalledWith(lead);
      expect(mockedApiClient.updateLead).not.toHaveBeenCalled();
      expect(results).toHaveLength(1);
      expect(results[0].action).toBe("created");
    });
  });

  describe("existing lead", () => {
    it("calls update when lookup returns lead with different data and returns action='updated'", async () => {
      const incomingLead = mockLead({ company: "New Corp" });
      const existingLead = mockLead({ company: "Old Corp" });
      const updatedLead = mockLead({ company: "New Corp" });

      mockedApiClient.lookupLead.mockResolvedValueOnce(existingLead);
      mockedApiClient.updateLead.mockResolvedValueOnce(updatedLead);

      const { results } = await processLeads([incomingLead]);

      expect(mockedApiClient.lookupLead).toHaveBeenCalledWith("jane@example.com");
      expect(mockedApiClient.updateLead).toHaveBeenCalledWith(incomingLead);
      expect(mockedApiClient.createLead).not.toHaveBeenCalled();
      expect(results).toHaveLength(1);
      expect(results[0].action).toBe("updated");
    });

    it("does not call update when existing lead has identical data and returns action='skipped'", async () => {
      const lead = mockLead();
      const existingLead = mockLead();

      mockedApiClient.lookupLead.mockResolvedValueOnce(existingLead);

      const { results } = await processLeads([lead]);

      expect(mockedApiClient.lookupLead).toHaveBeenCalledWith("jane@example.com");
      expect(mockedApiClient.updateLead).not.toHaveBeenCalled();
      expect(mockedApiClient.createLead).not.toHaveBeenCalled();
      expect(results).toHaveLength(1);
      expect(results[0].action).toBe("skipped");
    });
  });

  describe("invalid lead", () => {
    it("returns action='error' for invalid email and never calls API", async () => {
      const lead = mockLead({ email: "bademail" });

      const { results } = await processLeads([lead]);

      expect(mockedApiClient.lookupLead).not.toHaveBeenCalled();
      expect(mockedApiClient.createLead).not.toHaveBeenCalled();
      expect(mockedApiClient.updateLead).not.toHaveBeenCalled();
      expect(results).toHaveLength(1);
      expect(results[0].action).toBe("error");
      expect(results[0].error).toBeDefined();
    });
  });

  describe("duplicate email in batch", () => {
    it("processes first occurrence and skips the second duplicate email", async () => {
      const lead1 = mockLead({ name: "Jane Doe", email: "jane@example.com" });
      const lead2 = mockLead({ name: "Jane Again", email: "jane@example.com" });

      mockedApiClient.lookupLead.mockResolvedValueOnce(null);
      mockedApiClient.createLead.mockResolvedValueOnce(lead1);

      const { results } = await processLeads([lead1, lead2]);

      expect(mockedApiClient.lookupLead).toHaveBeenCalledTimes(1);
      expect(mockedApiClient.createLead).toHaveBeenCalledTimes(1);
      expect(results).toHaveLength(2);
      expect(results[0].action).toBe("created");
      expect(results[1].action).toBe("skipped");
    });
  });

  describe("API error handling", () => {
    it("returns action='error' when lookup throws and continues to next lead", async () => {
      const lead1 = mockLead({ email: "fail@example.com" });
      const lead2 = mockLead({ email: "success@example.com" });

      mockedApiClient.lookupLead
        .mockRejectedValueOnce(new Error("API lookup failed"))
        .mockResolvedValueOnce(null);
      mockedApiClient.createLead.mockResolvedValueOnce(lead2);

      const { results } = await processLeads([lead1, lead2]);

      expect(results).toHaveLength(2);
      expect(results[0].action).toBe("error");
      expect(results[0].error).toMatch(/API lookup failed/i);
      expect(results[1].action).toBe("created");
    });

    it("returns action='error' when create throws and continues to next lead", async () => {
      const lead1 = mockLead({ email: "fail@example.com" });
      const lead2 = mockLead({ email: "success@example.com" });

      mockedApiClient.lookupLead
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);
      mockedApiClient.createLead
        .mockRejectedValueOnce(new Error("API create failed"))
        .mockResolvedValueOnce(lead2);

      const { results } = await processLeads([lead1, lead2]);

      expect(results).toHaveLength(2);
      expect(results[0].action).toBe("error");
      expect(results[0].error).toMatch(/API create failed/i);
      expect(results[1].action).toBe("created");
    });
  });

  describe("summary counts", () => {
    it("returns correct summary with total, created, updated, skipped, and errors", async () => {
      const newLead = mockLead({ email: "new@example.com" });
      const changedLead = mockLead({ email: "changed@example.com", company: "New Corp" });
      const unchangedLead = mockLead({ email: "same@example.com" });
      const invalidLead = mockLead({ email: "bademail" });
      const dupeLead = mockLead({ email: "new@example.com", name: "Dupe" });

      // new@example.com → lookup null → create
      mockedApiClient.lookupLead
        .mockResolvedValueOnce(null)
        // changed@example.com → lookup returns old → update
        .mockResolvedValueOnce(mockLead({ email: "changed@example.com", company: "Old Corp" }))
        // same@example.com → lookup returns identical → skip
        .mockResolvedValueOnce(mockLead({ email: "same@example.com" }));

      mockedApiClient.createLead.mockResolvedValueOnce(newLead);
      mockedApiClient.updateLead.mockResolvedValueOnce(changedLead);

      const { summary } = await processLeads([
        newLead,
        changedLead,
        unchangedLead,
        invalidLead,
        dupeLead,
      ]);

      expect(summary).toEqual<ProcessSummary>({
        total: 5,
        created: 1,
        updated: 1,
        skipped: 2, // unchanged + duplicate
        errors: 1,  // invalid email
      });
    });
  });
});