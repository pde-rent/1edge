#!/usr/bin/env bun

import { getServiceConfig } from "./config";
import { logger } from "@back/utils/logger";
import type { StatusCheckerConfig, Service } from "@common/types";
import { ServiceStatus } from "@common/types";
import { services } from "@common/types";
import { SERVICE_PORTS } from "@common/constants";
import { sleep } from "@common/utils";

class StatusCheckerService {
  private config: StatusCheckerConfig;
  private isRunning: boolean = false;
  private intervalId: any;
  private statusCache: Map<string, Service> = new Map();
  
  constructor() {
    this.config = getServiceConfig("statusChecker");
    this.initializeServices();
  }
  
  private initializeServices() {
    // Initialize service status cache
    for (const service of services) {
      this.statusCache.set(service.id, {
        ...service,
        status: ServiceStatus.UNKNOWN,
        pingUrl: this.getPingUrl(service.id),
      });
    }
  }
  
  private getPingUrl(serviceId: string): string | undefined {
    switch (serviceId) {
      case "api":
        return `http://localhost:${SERVICE_PORTS.API}/ping`;
      case "collector":
        return undefined; // No direct ping endpoint
      case "order-executor":
        return undefined; // No direct ping endpoint
      case "keeper":
        return undefined; // No direct ping endpoint
      case "status-checker":
        return undefined; // Self
      default:
        return undefined;
    }
  }
  
  async start() {
    logger.info("Starting Status Checker service...");
    this.isRunning = true;
    
    // Initial check
    await this.checkAllServices();
    
    // Start polling
    this.intervalId = setInterval(async () => {
      if (this.isRunning) {
        await this.checkAllServices();
      }
    }, this.config.pollIntervalMs);
    
    logger.info(`Status Checker service started. Polling every ${this.config.pollIntervalMs}ms`);
  }
  
  async stop() {
    logger.info("Stopping Status Checker service...");
    this.isRunning = false;
    
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }
    
    logger.info("Status Checker service stopped");
  }
  
  private async checkAllServices() {
    logger.debug("Checking service statuses...");
    
    const checkPromises = Array.from(this.statusCache.values()).map(async (service) => {
      if (service.id === "status-checker") {
        // Self status is always UP
        this.updateServiceStatus(service.id, ServiceStatus.UP, 0);
      } else if (service.pingUrl) {
        await this.checkServiceHealth(service);
      } else {
        // For services without ping endpoints, check process status
        await this.checkProcessStatus(service);
      }
    });
    
    await Promise.all(checkPromises);
    
    // Log summary
    const upCount = Array.from(this.statusCache.values()).filter(
      (s) => s.status === ServiceStatus.UP
    ).length;
    const totalCount = this.statusCache.size;
    
    logger.info(`Service status: ${upCount}/${totalCount} services UP`);
  }
  
  private async checkServiceHealth(service: Service) {
    if (!service.pingUrl) return;
    
    const startTime = Date.now();
    
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.config.timeoutMs);
      
      const response = await fetch(service.pingUrl, {
        method: "GET",
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      const latency = Date.now() - startTime;
      
      if (response.ok) {
        this.updateServiceStatus(service.id, ServiceStatus.UP, latency);
      } else {
        this.updateServiceStatus(service.id, ServiceStatus.DOWN);
        logger.warn(`Service ${service.name} returned status ${response.status}`);
      }
    } catch (error: any) {
      this.updateServiceStatus(service.id, ServiceStatus.DOWN);
      logger.error(`Failed to check ${service.name}:`, error.message);
    }
  }
  
  private async checkProcessStatus(service: Service) {
    // Simple check - could be enhanced with actual process monitoring
    try {
      // Check if the service file exists
      const file = Bun.file(service.path!);
      if (await file.exists()) {
        // Service file exists, assume it could be running
        this.updateServiceStatus(service.id, ServiceStatus.UNKNOWN);
      } else {
        this.updateServiceStatus(service.id, ServiceStatus.DOWN);
      }
    } catch (error) {
      this.updateServiceStatus(service.id, ServiceStatus.UNKNOWN);
    }
  }
  
  private updateServiceStatus(
    serviceId: string,
    status: ServiceStatus,
    latencyMs?: number
  ) {
    const service = this.statusCache.get(serviceId);
    if (service) {
      service.status = status;
      service.latencyMs = latencyMs;
      service.checkedAt = Date.now();
      this.statusCache.set(serviceId, service);
    }
  }
  
  getServiceStatuses(): Service[] {
    return Array.from(this.statusCache.values());
  }
}

// Main execution
const statusChecker = new StatusCheckerService();

// Handle graceful shutdown
process.on("SIGINT", async () => {
  logger.info("Received SIGINT signal");
  await statusChecker.stop();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  logger.info("Received SIGTERM signal");
  await statusChecker.stop();
  process.exit(0);
});

// Start the service
statusChecker.start().catch((error) => {
  logger.error("Failed to start Status Checker service:", error);
  process.exit(1);
});