# 🎯 FINAL Interview Prep Guide: Lead Ingestion CLI — 50 Min TDD Plan

---

## PART 1: HIGH-LEVEL APPROACH (Explain to Interviewer — First 5 mins)

### What You'll Say:

> "Thanks for the challenge. Let me walk through my high-level approach before I start coding.
>
> I'm going to build a **CLI application** that reads a CSV of lead data, validates it, and then processes each lead by calling the API to **create, update, or skip** based on business logic. I'll follow **TDD** throughout — tests first, then implementation.
>
> Let me explain how I'll apply the engineering principles..."

---

### Engineering Principles — Explain Like This:

#### 1. Clean Code
> "I'll keep functions small and focused — each doing ONE thing. Meaningful names like `validateLead()`, `processLead()`, `lookupLead()`. No magic strings — constants for valid sources, etc. The code should read like English."

**Concrete example:** *"Instead of one giant function, I'll have separate modules: `csvParser`, `validator`, `apiClient`, `leadProcessor`, and `cli`. Each file under 100 lines."*

#### 2. SOLID Principles
> "Key ones I'll focus on:
> - **Single Responsibility**: CSV parser only parses. Validator only validates. API client only talks to API. Processor orchestrates.
> - **Open/Closed**: Validator accepts a config of allowed sources — add 'Facebook' later by updating config, not logic.
> - **Dependency Inversion**: Processor depends on API client interface — in tests I inject a mock, in production the real HTTP client."

**Concrete example:** *"My `processLeads()` function takes an `apiClient` as a parameter. In tests I pass a fake. In production I pass the real axios-based one. This makes TDD practical."*

#### 3. Error Handling
> "The API randomly throws 429s and 500s, so I'll implement:
> - **Retry with exponential backoff** for 429/500 (1s, 2s, 4s — max 3 retries)
> - **Validation errors** are logged and skipped (don't crash the batch)
> - **File errors** (not found, bad format) caught at top level with clear messages
> - Each lead processed independently — one failure doesn't stop the batch"

#### 4. Logging (Winston — Production Grade)
> "I'm using Winston for structured JSON logging — same as what we'd use in production with log aggregation tools like Datadog or CloudWatch."
> - `INFO`: Lead processed successfully (created/updated/skipped)
> - `WARN`: Validation errors, duplicate emails in CSV
> - `ERROR`: API failures after retries exhausted
> - Each log includes timestamp, module name, lead email, action, and outcome

---

### Questions to Ask the Interviewer:

1. **"Is Jest okay for testing?"**
2. **"For duplicate emails in CSV — process only first, skip rest?"**
3. **"Is 3 retries with exponential backoff acceptable?"**
4. **"Should CLI output a summary at the end?"**
5. **"For company name normalization — just trim and collapse spaces?"**

---

## PART 2: PROJECT STRUCTURE

```
lead-ingestion/
├── src/
│   ├── validator.ts        ← Step 1 (TDD)
│   ├── csvParser.ts        ← Step 2 (TDD)
│   ├── apiClient.ts        ← Step 3 (TDD)
│   ├── leadProcessor.ts    ← Step 4 (TDD)
│   ├── logger.ts           ← Winston logger utility
│   └── index.ts            ← CLI entry point
├── tests/
│   ├── validator.test.ts   ← Step 1
│   ├── csvParser.test.ts   ← Step 2
│   ├── apiClient.test.ts   ← Step 3
│   └── leadProcessor.test.ts ← Step 4
├── leads.csv
├── package.json
├── tsconfig.json
└── jest.config.js
```

---

## PART 3: TIMELINE (50 minutes)

| Time | Task | What You're Doing |
|------|------|-------------------|
| 0-5 min | High-level explanation | Explain approach to interviewer |
| 5-8 min | Project setup | npm init, install deps, config |
| 8-18 min | **Step 1: Validator (TDD)** | Tests first → implement |
| 18-28 min | **Step 2: CSV Parser (TDD)** | Tests first → implement |
| 28-38 min | **Step 3: API Client (TDD)** | Tests first → implement |
| 38-48 min | **Step 4: Processor + CLI (TDD)** | Tests first → wire together |
| 48-50 min | End-to-end demo | Run against mock API |

---

## PART 4: ALL AI PROMPTS

---

### STEP 0: Setup (3 min)

**Terminal commands:**
```bash
mkdir lead-ingestion && cd lead-ingestion
npm init -y
npm install typescript ts-node axios commander csv-parse winston
npm install --save-dev jest ts-jest @types/jest @types/node
npx tsc --init
```

---

**PROMPT 1 — Config files:**
```
Create config files for TypeScript Node.js project with Jest:

- tsconfig.json:
  - target ES2020, module commonjs
  - strict mode, esModuleInterop true
  - outDir ./dist, rootDir ./src

- jest.config.js:
  - ts-jest preset
  - testMatch for tests/*.test.ts

- package.json scripts:
  - "test": "jest"
  - "test:watch": "jest --watch"
  - "start": "ts-node src/index.ts"
```

---

**PROMPT 2 — Logger (Winston):**
```
Create src/logger.ts using winston:

- Format: combine timestamp + json
- Transport: console with colorize
- Log levels: error, warn, info, debug
- Default level from LOG_LEVEL env var or 'info'
- Export createLogger(module: string) function
  - adds module name to every log entry
- Example output:
  {"level":"info","message":"Lead created",
   "module":"processor","email":"test@example.com",
   "timestamp":"2024-01-01T12:00:00.000Z"}
```

---

### STEP 1: Validator — TDD (10 min) ⭐

**PROMPT 3 — Validator TESTS (write FIRST):**
```
Create tests/validator.test.ts.
Tests for validateLead(lead) returning {isValid, errors[]}

Lead type: {name, email, company, source}

Test cases:
- Valid lead returns isValid: true, empty errors
- Invalid email (no @) returns "Invalid email format"
- Email with spaces fails
- Missing name (empty string) returns "Name is required"
- Missing company returns "Company is required"
- Missing source returns "Source is required"
- Invalid source not in allowlist fails
  - allowlist: LinkedIn, Webinar, Conference,
    Referral, Twitter, Website
- Multiple errors collected at once
  (missing name AND invalid email)
- Company normalization: trims whitespace,
  collapses extra spaces

Also test detectDuplicateEmails(leads[]):
- Given array with duplicate emails
- Returns Map of email → array of row indices
- Non-duplicate emails not in map
```

▶️ **Run:** `npx jest tests/validator.test.ts` → see failures ❌

---

**PROMPT 4 — Validator IMPLEMENTATION:**
```
Create src/validator.ts to pass all validator tests:

- Export types: Lead, ValidationResult {isValid, errors[]}
- Export validateLead(lead):
  - Email regex: /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  - Check name, email, company, source required
  - Source must be in VALID_SOURCES
  - Collect ALL errors (don't return on first)
- Export normalizeCompany(company):
  - Trim and collapse multiple spaces
- Export VALID_SOURCES constant array
- Export detectDuplicateEmails(leads):
  - Returns Map<email, rowIndices[]>
```

▶️ **Run:** `npx jest tests/validator.test.ts` → all green ✅

---

### STEP 2: CSV Parser — TDD (10 min)

**PROMPT 5 — CSV Parser TESTS (write FIRST):**
```
Create tests/csvParser.test.ts.
Tests for parseCSVFile(path) returning Promise<Lead[]>

Test cases:
- Parses valid CSV with headers
  (Name, Email, Company, Source)
- Returns correct Lead[] array
- File not found throws descriptive error
- Permission error throws descriptive error
- Empty CSV (headers only) returns empty array
- Trims whitespace from all fields
- Invalid CSV format (missing headers) throws error
- Malformed rows (wrong column count) throws error

Use temp files:
- Create in beforeEach with os.tmpdir()
- Cleanup in afterEach
```

▶️ **Run:** `npx jest tests/csvParser.test.ts` → see failures ❌

---

**PROMPT 6 — CSV Parser IMPLEMENTATION:**
```
Create src/csvParser.ts to pass all CSV parser tests:

- Export parseCSVFile(filePath) using csv-parse/sync
- Read file with fs.readFileSync
- Map columns:
  - Name → name
  - Email → email
  - Company → company
  - Source → source
- Trim all field values
- Error handling:
  - File not found: throw "File not found: {path}"
  - Permission error: throw "Permission denied: {path}"
  - Missing headers: throw "Invalid CSV: missing required headers"
  - Malformed rows: throw descriptive error
- Empty CSV (no data rows): return []
- Import Lead type from './validator'
```

▶️ **Run:** `npx jest tests/csvParser.test.ts` → all green ✅

---

### STEP 3: API Client — TDD (10 min)

**PROMPT 7 — API Client TESTS (write FIRST):**
```
Create tests/apiClient.test.ts.
Mock axios with jest.mock('axios')

Test cases:
- lookup: calls GET /api/leads/lookup?email=...
  returns lead or null
- lookup: non-existent lead returns null
- create: calls POST /api/leads/create
  returns created lead
- update: calls POST /api/leads/update
  returns updated lead
- Retry on 429: fail once then succeed
  (uses mockImplementationOnce)
- Retry on 500: fail once then succeed
- Throws after max 3 retries exhausted
- NO retry on 400 (throws immediately)
- Network timeout (ECONNABORTED/ETIMEDOUT) retries
- Malformed API response (missing expected fields)
  throws descriptive error
```

▶️ **Run:** `npx jest tests/apiClient.test.ts` → see failures ❌

---

**PROMPT 8 — API Client IMPLEMENTATION:**
```
Create src/apiClient.ts to pass all API client tests:

- Export lookup(email), create(lead), update(lead)
- Private withRetry:
  - Exponential backoff (1s, 2s, 4s) for 429/500
  - No retry on 400
- Base URL from process.env.API_BASE_URL
  || "http://localhost:3001"
- BASE_DELAY=0 when NODE_ENV=test
- MAX_RETRIES=3
- Log retries using logger
- Response parsing:
  - lookup: GET /api/leads/lookup
    → { found, lead? } → return lead or null
  - create: POST /api/leads/create
    → { success, lead } → return lead
  - update: POST /api/leads/update
    → { success, lead } → return lead
- Handle network timeouts
  (ECONNABORTED/ETIMEDOUT) with retry
- Validate response shape,
  throw on malformed response
```

▶️ **Run:** `npx jest tests/apiClient.test.ts` → all green ✅

---

### STEP 4: Lead Processor + CLI — TDD (10 min)

**PROMPT 9 — Processor TESTS (write FIRST):**
```
Create tests/leadProcessor.test.ts.
Mock apiClient methods with jest.fn()

Test cases:
- New lead (lookup returns null)
  → calls create → action='created'
- Existing lead with different data
  → calls update → action='updated'
- Existing lead with identical data
  → no update call → action='skipped'
- Invalid lead (bad email)
  → action='error', API never called
- Duplicate email in batch
  → second one action='skipped'
- API error on lookup
  → action='error', continues to next lead
- API error on create
  → action='error', continues to next lead
- Summary counts correct:
  total, created, updated, skipped, errors
```

▶️ **Run:** `npx jest tests/leadProcessor.test.ts` → see failures ❌

---

**PROMPT 10 — Processor IMPLEMENTATION:**
```
Create src/leadProcessor.ts to pass all processor tests:

- Export ProcessingResult:
  {email, action, details}
  action: 'created' | 'updated' | 'skipped' | 'error'
- Export ProcessingSummary:
  {total, created, updated, skipped, errors, results[]}
- Export processLeads(leads, apiClient):
  For each lead:
  1. Validate → if invalid, log warn, mark error, continue
  2. Check duplicate email (track in Set)
     → if dup, log warn, mark skipped
  3. lookup(email) via apiClient
  4. If found AND data differs → update → 'updated'
  5. If found AND data identical → 'skipped'
  6. If not found → create → 'created'
  7. If API error → mark 'error', log, continue
  - Try-catch per lead (one failure doesn't stop batch)
  - Log summary at end
```

▶️ **Run:** `npx jest tests/leadProcessor.test.ts` → all green ✅

---

**PROMPT 11 — CLI Entry Point:**
```
Create src/index.ts using commander:

- Options:
  - --file <path> (required): CSV file path
  - --api-url <url> (default: http://localhost:3001)
- Flow:
  1. Parse CLI args
  2. Log "Starting lead ingestion from {file}"
  3. Parse CSV using parseCSVFile()
  4. Log "{count} leads loaded"
  5. Create apiClient with api-url
  6. Call processLeads(leads, apiClient)
  7. Print final summary table
  8. Exit code 0 if no errors, 1 if any errors
- Top-level try-catch for file/setup errors
- Under 40 lines
```

---

### FINAL: End-to-End Demo (2 min)

```bash
# Run all tests
npx jest

# Run against mock API (must be running in another terminal)
npx ts-node src/index.ts --file leads.csv --api-url http://localhost:3001
```

---

## PART 5: CSV DATA & EXPECTED BEHAVIOR

| # | Name | Email | Expected | Why |
|---|------|-------|----------|-----|
| 1 | Alice Johnson | alice@example.com | **SKIP** | Exists in API, data identical |
| 2 | Bob Smith | bob@startup.com | **SKIP** | Exists in API, data identical |
| 3 | Charlie Brown | charlie@peanuts.com | **CREATE** | Not in API |
| 4 | Diana Prince | diana@wonderwoman.com | **CREATE** | Not in API |
| 5 | Invalid User | invalid-email | **ERROR** | Bad email format |
| 6 | Duplicate User | alice@example.com | **SKIP** | Duplicate email in CSV |
| 7 | John Doe | john@newcompany.com | **CREATE** | Not in API |
| 8 | Jane Smith | jane@techfirm.com | **CREATE** | Not in API |
| 9 | Mike Wilson | mike@consulting.com | **CREATE** | Not in API |
| 10 | Sarah Davis | sarah@nonprofit.org | **CREATE** | Not in API |

**Expected Summary:** 6 created, 0 updated, 3 skipped, 1 error

**Pre-loaded in API:** alice@example.com (Acme Inc), bob@startup.com (Startup Co)

**Valid Sources:** LinkedIn, Webinar, Conference, Referral, Twitter, Website

---

## PART 6: API QUICK REFERENCE

| Endpoint | Method | Response |
|----------|--------|----------|
| `/api/leads/lookup?email={email}` | GET | `{ found: true/false, lead?: {...} }` |
| `/api/leads/create` | POST | `{ success: true, lead: {...} }` — 201 |
| `/api/leads/update` | POST | `{ success: true, lead: {...} }` — 200 |
| `/api/health` | GET | `{ status: 'healthy' }` |

**Random Errors:** 429 (10%), 500 (5%), Delay 100-1000ms

---

## PART 7: OPTIONAL OPTIMIZATIONS (If Extra Time)

Use these prompts ONLY if you finish early. They don't change existing tests.

**OPT 1 — Dry Run Mode (easiest, ~3 min):**
```
Add --dry-run flag to CLI:
- When set, do everything (parse, validate, lookup)
- But DON'T call create or update
- Log what WOULD have happened
- Great for production safety
```

**OPT 2 — Concurrent Processing (~5 min):**
```
Update processLeads for concurrency:
- Use Promise.allSettled with p-limit (concurrency=5)
- Process 5 leads in parallel
- Don't change interface or return type
- npm install p-limit
```

**OPT 3 — Results CSV Report (~5 min):**
```
After processing, write results CSV:
- File: results-{timestamp}.csv
- Columns: Email, Action, Details, Timestamp
- Use csv-stringify package
- Add --output-dir CLI option (default: current dir)
```

**OPT 4 — Progress Bar (~3 min):**
```
Add progress bar using cli-progress:
- Show: [████░░░░] 4/10 | 2 created | 1 skipped
- Update after each lead completes
- npm install cli-progress @types/cli-progress
```

**Best pick if you have 3-5 extra mins:** Go with **OPT 1 (Dry Run)** — simple, shows production thinking, interviewer will love it.

---

## PART 8: TALKING POINTS DURING INTERVIEW

**When writing tests:**
> "I'm writing tests first because TDD helps me think about the interface BEFORE implementation."

**When using AI:**
> "I'm using AI to generate boilerplate and test cases, but I'm reviewing everything. The engineering decisions are mine."

**When handling errors:**
> "Each lead is wrapped in try-catch — one bad record doesn't take down the whole batch. Production-grade batch processing."

**When explaining retry:**
> "Exponential backoff prevents thundering herd — if the API is overwhelmed, we back off progressively."

**When explaining SOLID:**
> "The processor doesn't know about HTTP or CSV — it only knows about leads and an API client interface. That's dependency inversion."

**When explaining Winston:**
> "I'm using Winston because in production we need structured JSON logging for log aggregation tools like Datadog or CloudWatch. It gives us levels, timestamps, and context fields out of the box."

---

## PART 9: REQUIREMENTS COVERAGE CHECKLIST ✅

| README Requirement | Covered In | Status |
|---|---|---|
| Email format validation | Prompt 3 (validator tests) | ✅ |
| Required fields (name, email, company, source) | Prompt 3 | ✅ |
| Company name normalization | Prompt 3 + 4 | ✅ |
| Source value allowlist | Prompt 3 | ✅ |
| Duplicate email detection within CSV | Prompt 3 + 9 | ✅ |
| Network timeouts | Prompt 7 (ECONNABORTED) | ✅ |
| Invalid CSV format | Prompt 5 (malformed rows, missing headers) | ✅ |
| Missing required fields | Prompt 3 | ✅ |
| API rate limiting (429) | Prompt 7 | ✅ |
| Malformed API responses | Prompt 7 | ✅ |
| File not found | Prompt 5 | ✅ |
| Permission errors | Prompt 5 | ✅ |
| Retry with exponential backoff | Prompt 7 + 8 | ✅ |
| Structured logging | Prompt 2 (Winston) | ✅ |
| CLI with argument parsing | Prompt 11 | ✅ |
| TDD approach | Every step: test → red → implement → green | ✅ |
| Clean Code | Small focused functions, meaningful names | ✅ |
| SOLID Principles | Separate modules, dependency injection | ✅ |

---

## CHEAT SHEET: Quick Commands

```bash
npx jest                           # Run all tests
npx jest tests/validator.test.ts   # Run one file
npx jest --watch                   # Watch mode
npx jest --verbose                 # See all test names

# End-to-end (mock API must be running)
npx ts-node src/index.ts --file leads.csv --api-url http://localhost:3001
```
