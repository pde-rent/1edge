#!/usr/bin/env bun

import { spawn } from "child_process";
import { services } from "@common/types";

async function startBackendServices() {
  console.log("Starting backend services...");
  
  const processes: any[] = [];
  
  for (const service of services) {
    if (service.path) {
      console.log(`Starting ${service.name}...`);
      
      const proc = spawn("bun", ["run", service.path], {
        stdio: "inherit",
        env: { ...process.env },
      });
      
      proc.on("error", (error) => {
        console.error(`Failed to start ${service.name}:`, error);
      });
      
      proc.on("exit", (code) => {
        if (code !== 0) {
          console.error(`${service.name} exited with code ${code}`);
        }
      });
      
      processes.push(proc);
    }
  }
  
  // Handle graceful shutdown
  process.on("SIGINT", () => {
    console.log("\nShutting down services...");
    processes.forEach((proc) => proc.kill());
    process.exit(0);
  });
  
  process.on("SIGTERM", () => {
    console.log("\nShutting down services...");
    processes.forEach((proc) => proc.kill());
    process.exit(0);
  });
  
  // Keep the script running
  await new Promise(() => {});
}

startBackendServices().catch(console.error);