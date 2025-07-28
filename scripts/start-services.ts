#!/usr/bin/env bun

import { spawn } from "child_process";

const services = [
  {
    name: "Collector",
    script: "back/services/collector.ts",
    description: "CCXT WebSocket price streaming from multiple exchanges"
  },
  {
    name: "API Server", 
    script: "back/services/apiServer.ts",
    description: "REST API for frontend and external access"
  },
  {
    name: "WebSocket Server",
    script: "back/services/websocketServer.ts", 
    description: "Real-time WebSocket server for client price updates"
  },
  {
    name: "Status Checker",
    script: "back/services/statusChecker.ts", 
    description: "Health monitoring for all services"
  }
  // NOTE: Keeper & Order Executor excluded - focus on price tracking only
];

async function startServices() {
  console.log("🚀 Starting 1edge core services (price tracking + API)...\n");
  
  const apiPort = process.env.API_PORT || "40005";
  const processes: any[] = [];

  // Start each service
  for (const service of services) {
    console.log(`📡 Starting ${service.name}: ${service.description}`);
    
    const child = spawn("bun", ["--watch", service.script], {
      stdio: ["inherit", "pipe", "pipe"],
      env: process.env
    });

    // Add service name prefix to output
    child.stdout?.on("data", (data) => {
      const lines = data.toString().trim().split('\n');
      lines.forEach((line: string) => {
        if (line.trim()) {
          console.log(`[${service.name}] ${line}`);
        }
      });
    });

    child.stderr?.on("data", (data) => {
      const lines = data.toString().trim().split('\n');
      lines.forEach((line: string) => {
        if (line.trim()) {
          console.error(`[${service.name}] ${line}`);
        }
      });
    });

    child.on("exit", (code) => {
      console.log(`[${service.name}] Process exited with code ${code}`);
    });

    processes.push(child);
  }

  console.log(`
✅ All services started successfully!

Running services:
${services.map(s => `  • ${s.name}`).join('\n')}

API Server: http://localhost:${apiPort}

Press Ctrl+C to stop all services
`);

  // Handle graceful shutdown
  const cleanup = () => {
    console.log('\n⏹️  Shutting down all services...');
    processes.forEach(child => {
      try {
        child.kill('SIGTERM');
      } catch (error) {
        console.error('Error killing process:', error);
      }
    });
    process.exit(0);
  };

  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);

  // Wait for all processes to exit
  await Promise.all(processes.map(child => new Promise(resolve => {
    child.on('exit', resolve);
  })));
}

startServices().catch((error) => {
  console.error("❌ Failed to start services:", error);
  process.exit(1);
});