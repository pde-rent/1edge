#!/usr/bin/env bun

import { spawn } from "child_process";
import { services } from "@common/types";
import { logger } from "./utils/logger";

async function startAll() {
  logger.info("Starting 1edge backend services...");

  const processes: any[] = [];

  for (const service of services) {
    if (service.path) {
      logger.info(`Starting ${service.name}...`);

      const proc = spawn("bun", ["run", service.path], {
        stdio: "inherit",
        env: { ...process.env },
      });

      proc.on("error", (error) => {
        logger.error(`Failed to start ${service.name}:`, error);
      });

      proc.on("exit", (code) => {
        if (code !== 0) {
          logger.error(`${service.name} exited with code ${code}`);
        }
      });

      processes.push(proc);
    }
  }

  // Handle graceful shutdown
  const shutdown = () => {
    logger.info("Shutting down services...");
    processes.forEach((proc) => proc.kill());
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  // Keep the process running
  await new Promise(() => {});
}

startAll().catch((error) => {
  logger.error("Failed to start services:", error);
  process.exit(1);
});
