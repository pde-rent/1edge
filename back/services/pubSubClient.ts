import { logger } from "@back/utils/logger";
import type { PairSymbol } from "@common/types";
import { INTRACO_PORT } from "@common/constants";

interface PubSubMessage {
  topic: string;
  data: any;
}

/**
 * Native Bun WebSocket pub/sub client for subscribing to price feeds
 * Used by WebSocket server to receive price updates from collector
 */
export class PubSubClient {
  private ws: WebSocket | null = null;
  private url: string;
  private subscribers: Map<string, Set<(data: any) => void>> = new Map();
  private reconnectInterval: any;
  private isConnecting: boolean = false;
  private reconnectDelay: number = 1000; // Start with 1s
  private maxReconnectDelay: number = 30000; // Max 30s
  private pingInterval: any;
  private readonly PING_INTERVAL_MS = 25_000; // 25 seconds

  constructor(host: string = "localhost", port: number = INTRACO_PORT) {
    this.url = `ws://${host}:${port}`;
  }

  async connect(): Promise<void> {
    if (
      this.isConnecting ||
      (this.ws && this.ws.readyState === WebSocket.OPEN)
    ) {
      return;
    }

    this.isConnecting = true;

    try {
      this.ws = new WebSocket(this.url);

      this.ws.onopen = () => {
        logger.info(`✅ PubSub client connected to ${this.url}`);
        this.isConnecting = false;
        this.reconnectDelay = 1000; // Reset delay on successful connection

        // Start ping interval
        this.startPingInterval();

        // Re-subscribe to all topics
        const topicCount = this.subscribers.size;
        logger.info(`📡 Re-subscribing to ${topicCount} topics`);
        for (const topic of this.subscribers.keys()) {
          // Re-subscribing to topic
          this.sendSubscribe(topic);
        }
      };

      this.ws.onmessage = (event) => {
        this.handleMessage(event.data);
      };

      this.ws.onclose = () => {
        logger.warn("📡 PubSub client disconnected");
        this.isConnecting = false;
        this.stopPingInterval();
        this.scheduleReconnect();
      };

      this.ws.onerror = (error) => {
        logger.error("📡 PubSub client error:", error);
        this.isConnecting = false;
      };
    } catch (error) {
      logger.error("Failed to connect to PubSub server:", error);
      this.isConnecting = false;
      this.scheduleReconnect();
    }
  }

  disconnect(): void {
    if (this.reconnectInterval) {
      clearInterval(this.reconnectInterval);
      this.reconnectInterval = null;
    }

    this.stopPingInterval();

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    this.subscribers.clear();
    logger.info("📡 PubSub client disconnected");
  }

  /**
   * Subscribe to a topic and receive updates
   */
  subscribe(topic: string, callback: (data: any) => void): void {
    if (!this.subscribers.has(topic)) {
      this.subscribers.set(topic, new Set());

      // Send subscribe message if connected
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.sendSubscribe(topic);
      }
    }

    this.subscribers.get(topic)!.add(callback);
    // Callback added for topic
  }

  /**
   * Unsubscribe from a topic
   */
  unsubscribe(topic: string, callback?: (data: any) => void): void {
    const topicSubscribers = this.subscribers.get(topic);
    if (!topicSubscribers) return;

    if (callback) {
      topicSubscribers.delete(callback);
      if (topicSubscribers.size === 0) {
        this.subscribers.delete(topic);
        this.sendUnsubscribe(topic);
      }
    } else {
      // Remove all subscribers for this topic
      this.subscribers.delete(topic);
      this.sendUnsubscribe(topic);
    }

    logger.debug(`📡 Unsubscribed from topic: ${topic}`);
  }

  /**
   * Subscribe to price updates for a specific symbol
   */
  subscribeToPrices(
    symbol: PairSymbol,
    callback: (priceData: any) => void,
  ): void {
    this.subscribe(`prices.${symbol}`, callback);
  }

  /**
   * Subscribe to all price updates
   */
  subscribeToAllPrices(
    callback: (symbol: PairSymbol, priceData: any) => void,
  ): void {
    this.subscribe("prices.*", (data) => {
      if (data.type === "price_update") {
        callback(data.symbol, data.data);
      }
    });
  }

  private sendSubscribe(topic: string): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(
        JSON.stringify({
          type: "subscribe",
          topic: topic,
        }),
      );
    }
  }

  private sendUnsubscribe(topic: string): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(
        JSON.stringify({
          type: "unsubscribe",
          topic: topic,
        }),
      );
    }
  }

  private startPingInterval(): void {
    this.stopPingInterval();
    this.pingInterval = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: "ping" }));
      }
    }, this.PING_INTERVAL_MS);
  }

  private stopPingInterval(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  private handleMessage(data: string): void {
    try {
      const message: PubSubMessage = JSON.parse(data);
      const { topic, data: messageData } = message;

      // Find matching subscribers
      let matchCount = 0;
      for (const [subscribedTopic, callbacks] of this.subscribers) {
        if (this.topicMatches(subscribedTopic, topic)) {
          matchCount++;
          for (const callback of callbacks) {
            try {
              callback(messageData);
            } catch (error) {
              logger.error(
                `Error in PubSub callback for topic ${topic}:`,
                error,
              );
            }
          }
        }
      }

      if (matchCount === 0) {
        logger.warn(`📡 No subscribers found for topic: ${topic}`);
      }
    } catch (error) {
      logger.error("Error parsing PubSub message:", error);
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

  private scheduleReconnect(): void {
    if (this.reconnectInterval) {
      clearInterval(this.reconnectInterval);
    }

    this.reconnectInterval = setTimeout(() => {
      logger.info(`📡 Attempting to reconnect to PubSub server...`);
      this.connect();
    }, this.reconnectDelay);

    // Exponential backoff with jitter
    this.reconnectDelay = Math.min(
      this.reconnectDelay * 2,
      this.maxReconnectDelay,
    );
  }

  /**
   * Get client connection status
   */
  isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }

  /**
   * Get subscription statistics
   */
  getStats() {
    const totalCallbacks = Array.from(this.subscribers.values()).reduce(
      (sum, callbacks) => sum + callbacks.size,
      0,
    );

    return {
      connected: this.isConnected(),
      topics: this.subscribers.size,
      totalCallbacks,
      url: this.url,
    };
  }
}
