#!/usr/bin/env bun

import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

async function killProcessOnPort(port: string) {
  try {
    // Find process using the port
    const { stdout } = await execAsync(`lsof -i :${port} -t`);
    const pids = stdout.trim().split("\n").filter(Boolean);
    
    if (pids.length === 0) {
      console.log(`No process found on port ${port}`);
      return;
    }
    
    // Kill the processes
    for (const pid of pids) {
      console.log(`Killing process ${pid} on port ${port}`);
      await execAsync(`kill -9 ${pid}`);
    }
    
    // Wait a moment for processes to fully terminate
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

// Get port from command line argument
const port = process.argv[2];

if (!port) {
  console.error("Please provide a port number");
  process.exit(1);
}

killProcessOnPort(port);