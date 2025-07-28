#!/usr/bin/env bun

import { spawn } from "child_process";
import { services } from "@common/types";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

async function killProcessOnPort(port: string) {
  try {
    const { stdout } = await execAsync(`lsof -i :${port} -t`);
    const pids = stdout.trim().split("\n").filter(Boolean);
    
    if (pids.length === 0) {
      console.log(`No process found on port ${port}`);
      return;
    }
    
    for (const pid of pids) {
      console.log(`Killing process ${pid} on port ${port}`);
      await execAsync(`kill -9 ${pid}`);
    }
    
    await new Promise(resolve => setTimeout(resolve, 1000));
    console.log(`Successfully killed process(es) on port ${port}`);
  } catch (error: any) {
    if (error.code === 1 && error.stdout === "") {
      console.log(`No process running on port ${port}`);
    } else {
      console.error(`Error killing process on port ${port}:`, error.message);
    }
  }
}

async function startBackendServices() {
  console.log("Starting backend services...");
  
  // Kill processes on all required ports first
  const ports = ["40005", "40006", "40007", "40008", "40009"];
  console.log("Cleaning up existing processes...");
  
  for (const port of ports) {
    await killProcessOnPort(port);
  }
  
  // Wait additional time for complete cleanup
  await new Promise(resolve => setTimeout(resolve, 2000));
  
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