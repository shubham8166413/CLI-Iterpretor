import { readFileSync } from 'fs';
import { parse } from 'csv-parse/sync';
import { Lead } from './validator';

const REQUIRED_HEADERS = ['Name', 'Email', 'Company', 'Source'] as const;
const COLUMN_MAP: Record<string, keyof Lead> = {
  Name: 'name',
  Email: 'email',
  Company: 'company',
  Source: 'source',
};

/**
 * Reads file content with descriptive error handling
 */
function readFile(filePath: string): string {
  try {
    return readFileSync(filePath, 'utf-8');
  } catch (error: any) {
    const errorMessages: Record<string, string> = {
      ENOENT: `File not found: ${filePath}`,
      EACCES: `Permission denied: ${filePath}`,
    };
    throw new Error(errorMessages[error.code] ?? error.message);
  }
}

/**
 * Validates that all required headers are present
 */
function validateHeaders(content: string): void {
  const headerLine = content.split('\n')[0] ?? '';
  const headers = headerLine.split(',').map((h) => h.trim());
  
  const missing = REQUIRED_HEADERS.find((h) => !headers.includes(h));
  if (missing) {
    throw new Error(`Invalid CSV: missing required header "${missing}"`);
  }
}

/**
 * Validates row column counts
 */
function validateRows(content: string): void {
  const lines = content.trim().split('\n').slice(1);
  
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim() === '') continue;
    
    const columnCount = lines[i].split(',').length;
    if (columnCount !== REQUIRED_HEADERS.length) {
      throw new Error(
        `Malformed row ${i + 2}: expected ${REQUIRED_HEADERS.length} columns, got ${columnCount}`
      );
    }
  }
}

/**
 * Maps CSV record to Lead object
 */
const mapToLead = (record: Record<string, string>): Lead => ({
  name: record.Name?.trim() ?? '',
  email: record.Email?.trim() ?? '',
  company: record.Company?.trim() ?? '',
  source: record.Source?.trim() ?? '',
});

/**
 * Parses a CSV file and returns an array of Lead objects
 */
export async function parseCSVFile(filePath: string): Promise<Lead[]> {
  const content = readFile(filePath);
  
  // Validate structure before parsing
  validateHeaders(content);
  validateRows(content);

  // Parse CSV
  try {
    const records = parse(content, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    });
    
    return records.map(mapToLead);
  } catch (error: any) {
    throw new Error(`Malformed CSV row: ${error.message}`);
  }
}
