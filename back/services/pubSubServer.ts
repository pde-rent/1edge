import { logger } from "@back/utils/logger";
import type { Symbol } from "@common/types";
import { INTRACO_PORT } from "@common/constants";

interface ClientState {
  topics: Set<string>;
  joined: number;
  lastPing: number;
}

/**
 * Native Bun WebSocket pub/sub server for internal service communication
 * Used by collector to publish price feeds to WebSocket servers
 */
export class PubSubServer {
  private clients = new Map<any, ClientState>();
  private server: any = null;
  private port: number;
  private cleanupInterval: any;
  private readonly HWM_MS = 15 * 60 * 1000; // 15 minutes high water mark
  private readonly PING_TIMEOUT = 30_000; // 30 seconds ping timeout

  constructor(port: number = INTRACO_PORT) {
    this.port = port;
  }

  async start() {
    this.server = Bun.serve({
      port: this.port,
      websocket: {
        open: (ws: any) => {
          this.clients.set(ws, {
            topics: new Set(),
            joined: Date.now(),
            lastPing: Date.now(),
          });
          logger.debug(
            `📡 PubSub client connected. Total: ${this.clients.size}`,
          );
        },

        message: (ws: any, message: string | Buffer) => {
          const state = this.clients.get(ws);
          if (!state) return;

          let msg: any;
          try {
            msg = JSON.parse(message.toString());
          } catch {
            return; // Invalid JSON
          }

          if (msg.type === "subscribe" && typeof msg.topic === "string") {
            state.topics.add(msg.topic);
            logger.debug(`📡 Client subscribed to topic: ${msg.topic}`);
          }

          if (msg.type === "unsubscribe" && typeof msg.topic === "string") {
            state.topics.delete(msg.topic);
            logger.debug(`📡 Client unsubscribed from topic: ${msg.topic}`);
          }

          if (msg.type === "ping") {
            state.lastPing = Date.now();
          }
        },

        close: (ws: any) => {
          this.clients.delete(ws);
          logger.debug(
            `📡 PubSub client disconnected. Total: ${this.clients.size}`,
          );
        },
      },

      fetch: (req: Request, server: any) => {
        if (req.headers.get("upgrade") === "websocket") {
          return server.upgrade(req);
        }
        return new Response("PubSub Server OK", { status: 200 });
      },
    });

    // Start cleanup interval
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 10_000);

    logger.info(`📡 PubSub Server listening on ws://localhost:${this.port}`);
  }

  async stop() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }

    if (this.server) {
      this.server.stop();
      this.server = null;
    }

    this.clients.clear();
    logger.info("📡 PubSub Server stopped");
  }

  /**
   * Publish data to a specific topic
   */
  publish(topic: string, data: any) {
    const now = Date.now();
    const message = JSON.stringify({ topic, data });

    logger.debug(
      `📡 Publishing to topic "${topic}" with ${this.clients.size} connected clients`,
    );

    let sentCount = 0;
    for (const [ws, state] of this.clients) {
      // High water mark: disconnect clients that are too old or haven't pinged
      if (
        now - state.joined > this.HWM_MS ||
        now - state.lastPing > this.PING_TIMEOUT
      ) {
        logger.debug(
          `📡 Disconnecting stale client (age: ${now - state.joined}ms, last ping: ${now - state.lastPing}ms)`,
        );
        ws.close();
        this.clients.delete(ws);
        continue;
      }

      // Send to subscribed clients only (with wildcard support)
      let shouldSend = false;
      for (const subscribedTopic of state.topics) {
        if (this.topicMatches(subscribedTopic, topic)) {
          shouldSend = true;
          break;
        }
      }

      if (shouldSend) {
        try {
          ws.send(message);
          sentCount++;
        } catch (error) {
          logger.error(`Failed to send message to client:`, error);
          ws.close();
          this.clients.delete(ws);
        }
      }
    }

    if (sentCount > 0) {
      logger.debug(`📡 Published "${topic}" to ${sentCount} subscribers`);
    } else {
      logger.debug(`📡 No subscribers for topic "${topic}"`);
    }
  }

  /**
   * Publish price update for a symbol
   */
  publishPrice(symbol: Symbol, priceData: any) {
    this.publish(`prices.${symbol}`, {
      type: "price_update",
      symbol,
      data: priceData,
      timestamp: Date.now(),
    });
  }

  /**
   * Get server statistics
   */
  getStats() {
    const totalSubscriptions = Array.from(this.clients.values()).reduce(
      (sum, state) => sum + state.topics.size,
      0,
    );

    return {
      connectedClients: this.clients.size,
      totalSubscriptions,
      port: this.port,
    };
  }

  private cleanup() {
    for (const [ws, state] of this.clients) {
      // Remove disconnected clients
      if (!ws.readyState || ws.readyState === WebSocket.CLOSED) {
        this.clients.delete(ws);
      }
    }
  }

  private topicMatches(subscribed: string, received: string): boolean {
    // Handle wildcard subscriptions
    if (subscribed.endsWith("*")) {
      const prefix = subscribed.slice(0, -1);
      return received.startsWith(prefix);
    }

    return subscribed === received;
  }
}

// Export singleton instance
export const pubSubServer = new PubSubServer();
