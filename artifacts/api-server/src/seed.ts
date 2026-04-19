import { bootstrapDemoData } from "./lib/bootstrapDemoData";
import { logger } from "./lib/logger";

async function seed() {
  logger.info("Starting seed...");
  await bootstrapDemoData();
  logger.info("Seed complete");
  process.exit(0);
}

seed().catch((err) => {
  logger.error({ err }, "Seed failed");
  process.exit(1);
});
