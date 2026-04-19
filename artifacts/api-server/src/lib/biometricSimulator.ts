import { db, biometricReadingsTable } from "@workspace/db";
import { logger } from "./logger";

const activeSimulations = new Map<number, NodeJS.Timeout>();

function generateHrReading(): number {
  return Math.round(65 + Math.random() * 35);
}

function generateHrvReading(): number {
  return Math.round(30 + Math.random() * 50);
}

export function startSimulation(sessionId: number): void {
  if (activeSimulations.has(sessionId)) {
    logger.warn({ sessionId }, "Simulation already active");
    return;
  }

  logger.info({ sessionId }, "Starting biometric simulation");

  const interval = setInterval(async () => {
    try {
      const now = new Date();
      await db.insert(biometricReadingsTable).values([
        { sessionId, metric: "HR", value: generateHrReading(), recordedAt: now },
        { sessionId, metric: "HRV", value: generateHrvReading(), recordedAt: now },
      ]);
    } catch (err) {
      logger.error({ err, sessionId }, "Biometric simulation write failed");
    }
  }, 5000);

  activeSimulations.set(sessionId, interval);
}

export function stopSimulation(sessionId: number): void {
  const interval = activeSimulations.get(sessionId);
  if (!interval) return;

  clearInterval(interval);
  activeSimulations.delete(sessionId);
  logger.info({ sessionId }, "Stopped biometric simulation");
}
