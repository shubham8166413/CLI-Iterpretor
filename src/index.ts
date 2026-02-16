import { Command } from "commander";
import { createLogger } from "./logger";
import { parseCSVFile } from "./csvParser";
import { processLeads } from "./leadProcessor";

const logger = createLogger("main");

const program = new Command();
program
  .requiredOption("--file <path>", "CSV file path")
  .option("--api-url <url>", "API base URL", "http://localhost:3001")
  .parse(process.argv);

const opts = program.opts<{ file: string; apiUrl: string }>();

async function main(): Promise<void> {
  try {
    process.env.API_BASE_URL = opts.apiUrl;
    logger.info(`Starting lead ingestion from ${opts.file}`);

    const leads = await parseCSVFile(opts.file);
    logger.info(`${leads.length} leads loaded`);

    const { summary } = await processLeads(leads);

    console.table(summary);

    if (summary.errors > 0) {
      logger.warn(`Completed with ${summary.errors} error(s)`);
      process.exit(1);
    }

    logger.info("Lead ingestion completed successfully");
    process.exit(0);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error(`Fatal error: ${message}`);
    process.exit(1);
  }
}

main();