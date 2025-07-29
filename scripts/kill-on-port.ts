#!/usr/bin/env bun

import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

async function killProcessOnPort(port: string) {
  try {
    const { stdout } = await execAsync(`lsof -i :${port} -P`);
    const lines = stdout.trim().split("\n").slice(1); // Skip header

    if (lines.length === 0) {
      console.log(`No process on port ${port}`);
      return;
    }

    const serverPids = lines
      .map((line) => {
        const [command, pid, , , type] = line.split(/\s+/);
        const isBrowser = /chrome|firefox|safari|edge/i.test(command);
        const isServer = type === "LISTEN" || /node|bun|next/.test(command);
        return isServer && !isBrowser ? pid : null;
      })
      .filter(Boolean);

    if (serverPids.length === 0) {
      console.log(`No server processes on port ${port}`);
      return;
    }

    for (const pid of serverPids) {
      console.log(`Killing process ${pid}`);
      try {
        await execAsync(`kill ${pid}`);
        await new Promise((resolve) => setTimeout(resolve, 1000));
        try {
          await execAsync(`kill -0 ${pid}`);
          await execAsync(`kill -9 ${pid}`);
        } catch {}
      } catch {}
    }

    console.log(`Killed ${serverPids.length} process(es) on port ${port}`);
  } catch (error: any) {
    if (error.code === 1) {
      console.log(`No process on port ${port}`);
    } else {
      console.error(`Error: ${error.message}`);
    }
  }
}

// Get port from command line argument
const port = process.argv[2];

if (!port) {
  console.error("Please provide a port number");
  process.exit(1);
}

killProcessOnPort(port);
