#!/usr/bin/env bun

import { spawn } from "child_process";
import { services } from "@common/types";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

async function killProcessOnPort(port: string) {
  try {
    const { stdout } = await execAsync(`lsof -i :${port} -P`);
    const lines = stdout.trim().split("\n").slice(1); // Skip header

    if (lines.length === 0) {
      console.log(`No process running on port ${port}`);
      return;
    }

    const serverPids = lines
      .map((line) => {
        const [command, pid, , , type] = line.split(/\s+/);
        const isBrowser = /chrome|firefox|safari|edge|webkit/i.test(command);
        const isServer =
          type === "LISTEN" || /node|bun|next|deno/i.test(command);
        return isServer && !isBrowser ? pid : null;
      })
      .filter(Boolean);

    if (serverPids.length === 0) {
      console.log(`No server processes running on port ${port}`);
      return;
    }

    for (const pid of serverPids) {
      console.log(`Killing server process ${pid} on port ${port}`);
      try {
        // Try graceful termination first
        await execAsync(`kill ${pid}`);
        await new Promise((resolve) => setTimeout(resolve, 1000));

        // Check if still running, force kill if needed
        try {
          await execAsync(`kill -0 ${pid}`);
          await execAsync(`kill -9 ${pid}`);
          console.log(`Force killed process ${pid}`);
        } catch {
          // Process already terminated gracefully
        }
      } catch (error: any) {
        console.error(`Failed to kill process ${pid}:`, error.message);
      }
    }

    console.log(
      `Cleaned up ${serverPids.length} server process(es) on port ${port}`,
    );
  } catch (error: any) {
    if (error.code === 1) {
      console.log(`No process running on port ${port}`);
    } else {
      console.error(`Error checking port ${port}:`, error.message);
    }
  }
}

async function startBackendServices() {
  console.log("Starting backend services...");

  // Kill processes on backend ports only (excluding 40006 which is frontend)
  const ports = ["40005", "40007", "40008", "40009", "40011", "40042"];
  console.log("Cleaning up existing processes...");

  for (const port of ports) {
    await killProcessOnPort(port);
  }

  // Wait additional time for complete cleanup
  await new Promise((resolve) => setTimeout(resolve, 2000));

  const processes: any[] = [];

  // Start only essential backend services
  const essentialServices = services.filter((service) =>
    ["collector", "api", "websocket", "order-registry", "status-checker"].includes(service.id),
  );

  for (const service of essentialServices) {
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

      // Add delay between service starts to ensure proper initialization
      if (service.id === "collector") {
        console.log("Waiting for collector to initialize pub/sub server...");
        await new Promise((resolve) => setTimeout(resolve, 3000));
      } else if (service.id === "api" || service.id === "websocket" || service.id === "order-registry") {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
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
