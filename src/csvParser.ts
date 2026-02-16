import * as fs from "fs";
import { parse } from "csv-parse/sync";
import { Lead } from "./validator";

const REQUIRED_HEADERS = ["Name", "Email", "Company", "Source"];

export async function parseCSVFile(filePath: string): Promise<Lead[]> {
  let content: string;

  try {
    content = fs.readFileSync(filePath, "utf-8");
  } catch (err: unknown) {
    const fsError = err as NodeJS.ErrnoException;
    if (fsError.code === "ENOENT") {
      throw new Error(`File not found: ${filePath}`);
    }
    if (fsError.code === "EACCES") {
      throw new Error(`Permission denied: ${filePath}`);
    }
    throw err;
  }

  const lines = content.trim().split("\n");

  if (lines.length === 0 || lines[0].trim() === "") {
    throw new Error("Invalid CSV: missing required headers");
  }

  const headers = lines[0].split(",").map((h) => h.trim());

  for (const required of REQUIRED_HEADERS) {
    if (!headers.includes(required)) {
      throw new Error(
        `Invalid CSV: missing required headers. Expected: ${REQUIRED_HEADERS.join(", ")}. Got: ${headers.join(", ")}`
      );
    }
  }

  let records: Record<string, string>[];

  try {
    records = parse(content, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      relax_column_count: false,
    });
  } catch (err: unknown) {
    const parseError = err as Error;
    if (/column/i.test(parseError.message) || /field/i.test(parseError.message)) {
      throw new Error(`Malformed CSV: column count mismatch. ${parseError.message}`);
    }
    throw new Error(`Malformed CSV: ${parseError.message}`);
  }

  const leads: Lead[] = records.map((record) => ({
    name: (record["Name"] ?? "").trim(),
    email: (record["Email"] ?? "").trim(),
    company: (record["Company"] ?? "").trim(),
    source: (record["Source"] ?? "").trim(),
  }));

  return leads;
}