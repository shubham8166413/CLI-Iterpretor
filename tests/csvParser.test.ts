import { parseCSVFile } from "../src/csvParser";
import { Lead } from "../src/validator";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

describe("parseCSVFile", () => {
  let tmpDir: string;
  const tempFiles: string[] = [];

  function createTempCSV(content: string): string {
    const filePath = path.join(tmpDir, `test-${Date.now()}-${Math.random().toString(36).slice(2)}.csv`);
    fs.writeFileSync(filePath, content, "utf-8");
    tempFiles.push(filePath);
    return filePath;
  }

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "csv-parser-test-"));
  });

  afterEach(() => {
    for (const file of tempFiles) {
      try {
        fs.unlinkSync(file);
      } catch {
        // already cleaned up
      }
    }
    tempFiles.length = 0;

    try {
      fs.rmdirSync(tmpDir);
    } catch {
      // already cleaned up
    }
  });

  it("parses a valid CSV with headers and returns Lead[]", async () => {
    const csv = [
      "Name,Email,Company,Source",
      "Alice Johnson,alice@example.com,Acme Inc,LinkedIn",
      "Bob Smith,bob@startup.com,Startup Co,Webinar",
    ].join("\n");

    const filePath = createTempCSV(csv);
    const result = await parseCSVFile(filePath);

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual<Lead>({
      name: "Alice Johnson",
      email: "alice@example.com",
      company: "Acme Inc",
      source: "LinkedIn",
    });
    expect(result[1]).toEqual<Lead>({
      name: "Bob Smith",
      email: "bob@startup.com",
      company: "Startup Co",
      source: "Webinar",
    });
  });

  it("returns correct Lead[] with all four fields mapped", async () => {
    const csv = [
      "Name,Email,Company,Source",
      "Diana Prince,diana@wonderwoman.com,Justice League,Referral",
    ].join("\n");

    const filePath = createTempCSV(csv);
    const result = await parseCSVFile(filePath);

    expect(result).toHaveLength(1);
    const lead = result[0];
    expect(lead).toHaveProperty("name", "Diana Prince");
    expect(lead).toHaveProperty("email", "diana@wonderwoman.com");
    expect(lead).toHaveProperty("company", "Justice League");
    expect(lead).toHaveProperty("source", "Referral");
  });

  it("throws a descriptive error when file is not found", async () => {
    const fakePath = path.join(tmpDir, "nonexistent.csv");

    await expect(parseCSVFile(fakePath)).rejects.toThrow(/not found|no such file|ENOENT/i);
  });

  it("throws a descriptive error on permission denied", async () => {
    const csv = "Name,Email,Company,Source\n";
    const filePath = createTempCSV(csv);
    fs.chmodSync(filePath, 0o000);

    await expect(parseCSVFile(filePath)).rejects.toThrow(/permission|EACCES/i);

    // Restore permissions so afterEach cleanup works
    fs.chmodSync(filePath, 0o644);
  });

  it("returns an empty array for a CSV with headers only", async () => {
    const csv = "Name,Email,Company,Source\n";

    const filePath = createTempCSV(csv);
    const result = await parseCSVFile(filePath);

    expect(result).toEqual([]);
  });

  it("trims whitespace from all fields", async () => {
    const csv = [
      "Name,Email,Company,Source",
      "  Alice Johnson  ,  alice@example.com  ,  Acme Inc  ,  LinkedIn  ",
    ].join("\n");

    const filePath = createTempCSV(csv);
    const result = await parseCSVFile(filePath);

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual<Lead>({
      name: "Alice Johnson",
      email: "alice@example.com",
      company: "Acme Inc",
      source: "LinkedIn",
    });
  });

  it("throws an error when required headers are missing", async () => {
    const csv = [
      "FirstName,EmailAddress,Org",
      "Alice,alice@example.com,Acme",
    ].join("\n");

    const filePath = createTempCSV(csv);

    await expect(parseCSVFile(filePath)).rejects.toThrow(/header|missing/i);
  });

  it("throws an error for malformed rows with wrong column count", async () => {
    const csv = [
      "Name,Email,Company,Source",
      "Alice Johnson,alice@example.com",
    ].join("\n");

    const filePath = createTempCSV(csv);

    await expect(parseCSVFile(filePath)).rejects.toThrow(/column|field|malformed|mismatch/i);
  });
});