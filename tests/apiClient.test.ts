import axios, { isAxiosError } from "axios";
import {
  lookupLead,
  createLead,
  updateLead,
} from "../src/apiClient";
import { Lead } from "../src/validator";
import { response } from "express";

jest.mock("axios");

const mockedAxios = axios as jest.Mocked<typeof axios>;

function mockLead(overrides: Partial<Lead> = {}): Lead {
  return {
    name: "Jane Doe",
    email: "jane@example.com",
    company: "Acme Corp",
    source: "LinkedIn",
    ...overrides,
  };
}

describe("apiClient", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("lookupLead", () => {
    it("calls GET /api/leads/lookup with email query param and returns lead", async () => {
      const lead = mockLead();
      mockedAxios.get.mockResolvedValueOnce({ data: lead, status: 200 });

      const result = await lookupLead("jane@example.com");

      expect(mockedAxios.get).toHaveBeenCalledTimes(1);
      expect(mockedAxios.get).toHaveBeenCalledWith(
        expect.stringContaining("/api/leads/lookup"),
        expect.objectContaining({
          params: { email: "jane@example.com" },
        })
      );
      expect(result).toEqual(lead);
    });

    it("returns null when lead is not found (404)", async () => {
      const error = {
        isAxiosError: true,
        response: { status: 404, data: {} },
      };
      mockedAxios.get.mockRejectedValueOnce(error);

      const result = await lookupLead("nobody@example.com");

      expect(result).toBeNull();
    });
  });

  describe("createLead", () => {
    it("calls POST /api/leads/create and returns the created lead", async () => {
      const lead = mockLead();
      mockedAxios.post.mockResolvedValueOnce({ data: lead, status: 201 });

      const result = await createLead(lead);

      expect(mockedAxios.post).toHaveBeenCalledTimes(1);
      expect(mockedAxios.post).toHaveBeenCalledWith(
        expect.stringContaining("/api/leads/create"),
        lead
      );
      expect(result).toEqual(lead);
    });
  });

  describe("updateLead", () => {
    it("calls POST /api/leads/update and returns the updated lead", async () => {
      const lead = mockLead({ company: "New Corp" });
      mockedAxios.post.mockResolvedValueOnce({ data: lead, status: 200 });

      const result = await updateLead(lead);

      expect(mockedAxios.post).toHaveBeenCalledTimes(1);
      expect(mockedAxios.post).toHaveBeenCalledWith(
        expect.stringContaining("/api/leads/update"),
        lead
      );
      expect(result).toEqual(lead);
    });
  });

  describe("retry logic", () => {
    it("retries on 429 (rate limit) and succeeds on second attempt", async () => {
      const error429 = {
        isAxiosError: true,
        response: { status: 429, data: {} },
      };
      const lead = mockLead();

      mockedAxios.get
        .mockRejectedValueOnce(error429)
        .mockResolvedValueOnce({ data: lead, status: 200 });

      const result = await lookupLead("jane@example.com");

      expect(mockedAxios.get).toHaveBeenCalledTimes(2);
      expect(result).toEqual(lead);
    });

    it("retries on 500 (server error) and succeeds on second attempt", async () => {
      const error500 = {
        isAxiosError: true,
        response: { status: 500, data: {} },
      };
      const lead = mockLead();

      mockedAxios.post
        .mockRejectedValueOnce(error500)
        .mockResolvedValueOnce({ data: lead, status: 201 });

      const result = await createLead(lead);

      expect(mockedAxios.post).toHaveBeenCalledTimes(2);
      expect(result).toEqual(lead);
    });

    it("throws after max 3 retries are exhausted", async () => {
      const error500 = {
        isAxiosError: true,
        response: { status: 500, data: {} },
      };

      mockedAxios.get
        .mockRejectedValueOnce(error500)
        .mockRejectedValueOnce(error500)
        .mockRejectedValueOnce(error500);

      await expect(lookupLead("jane@example.com")).rejects.toThrow(
        /max retries|retry|exhausted/i
      );

      expect(mockedAxios.get).toHaveBeenCalledTimes(3);
    });

    it("does NOT retry on 400 (bad request) and throws immediately", async () => {
      const error400 = {
        isAxiosError: true,
        response: { status: 400, data: { message: "Bad request" } },
      };

      mockedAxios.post.mockRejectedValueOnce(error400);

      await expect(createLead(mockLead())).rejects.toMatchObject({
        isAxiosError: true,
        response: { status: 400 },
      });

      expect(mockedAxios.post).toHaveBeenCalledTimes(1);
    });

    it("retries on network timeout (ECONNABORTED) and succeeds", async () => {
      const timeoutError = {
        isAxiosError: true,
        code: "ECONNABORTED",
        response: undefined,
      };
      const lead = mockLead();

      mockedAxios.get
        .mockRejectedValueOnce(timeoutError)
        .mockResolvedValueOnce({ data: lead, status: 200 });

      const result = await lookupLead("jane@example.com");

      expect(mockedAxios.get).toHaveBeenCalledTimes(2);
      expect(result).toEqual(lead);
    });

    it("retries on network timeout (ETIMEDOUT) and succeeds", async () => {
      const timeoutError = {
        isAxiosError: true,
        code: "ETIMEDOUT",
        response: undefined,
      };
      const lead = mockLead();

      mockedAxios.get
        .mockRejectedValueOnce(timeoutError)
        .mockResolvedValueOnce({ data: lead, status: 200 });

      const result = await lookupLead("jane@example.com");

      expect(mockedAxios.get).toHaveBeenCalledTimes(2);
      expect(result).toEqual(lead);
    });
  });

  describe("malformed API response", () => {
    it("throws a descriptive error when response is missing expected fields", async () => {
      mockedAxios.get.mockResolvedValueOnce({
        data: { foo: "bar" },
        status: 200,
      });

      await expect(lookupLead("jane@example.com")).rejects.toThrow(
        /malformed|invalid|missing.*field/i
      );
    });

    it("throws a descriptive error when response data is null", async () => {
      mockedAxios.post.mockResolvedValueOnce({
        data: null,
        status: 201,
      });

      await expect(createLead(mockLead())).rejects.toThrow(
        /malformed|invalid|missing/i
      );
    });
  });
});