import app from "./app";
import { bootstrapDemoData } from "./lib/bootstrapDemoData";
import { getDemoReadiness } from "./lib/demoReadiness";
import { logger } from "./lib/logger";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

async function start() {
  try {
    await bootstrapDemoData();
    const readiness = await getDemoReadiness();
    logger.info(readiness, "Demo readiness verified");
  } catch (err) {
    logger.error({ err }, "Failed to bootstrap demo data");
    process.exit(1);
  }

  app.listen(port, (err) => {
    if (err) {
      logger.error({ err }, "Error listening on port");
      process.exit(1);
    }

    logger.info({ port }, "Server listening");
  });
}

void start();
