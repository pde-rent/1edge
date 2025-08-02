import { Database } from "bun:sqlite";
import { join } from "path";
import { mkdir } from "fs/promises";
import type {
  Order,
  Position,
  Strategy,
  TickerFeed,
  AggregatedTicker,
  OrderEvent,
  Config,
} from "@common/types";
import { logger } from "@back/utils/logger";

class StorageService {
  private db: Database;
  private ttlMap: Map<string, number> = new Map();
  private preparedStatements: Map<string, any> = new Map();

  constructor(private config: Config["storage"]) {
    const dbPath = config.dbPath || "./data/1edge.db";
    this.initDatabase(dbPath);
    this.db = new Database(dbPath);
    this.migrateDatabase();
    this.setupTables();
    this.setupOptimizations();
    this.prepareCriticalStatements();
  }

  private async initDatabase(dbPath: string) {
    const dir = join(process.cwd(), "data");
    await mkdir(dir, { recursive: true });
  }

  private migrateDatabase() {
    // Check if we need to migrate from old schema
    try {
      const result = this.db
        .prepare("PRAGMA table_info(orders)")
        .all() as Array<{ name: string }>;
      const hasRawData = result.some((col) => col.name === "raw_data");
      const hasTriggerType = result.some((col) => col.name === "trigger_type");

      if (!hasRawData || !hasTriggerType) {
        logger.info(
          "Migrating database schema to support complete Order serialization...",
        );
        // Drop and recreate tables for clean migration
        this.db.run("DROP TABLE IF EXISTS orders");
        this.db.run("DROP TABLE IF EXISTS order_events");
        logger.info("Database migration completed");
      }
    } catch (error) {
      // Table doesn't exist yet, no migration needed
      logger.debug("No migration needed - fresh database");
    }
  }

  private setupTables() {
    // Orders table
    this.db.run(`
      CREATE TABLE IF NOT EXISTS orders (
        id TEXT PRIMARY KEY,
        order_hash TEXT UNIQUE,
        strategy_id TEXT,
        type TEXT NOT NULL,
        status TEXT NOT NULL,
        maker_asset TEXT NOT NULL,
        taker_asset TEXT NOT NULL,
        making_amount TEXT NOT NULL,
        taking_amount TEXT NOT NULL,
        maker TEXT NOT NULL,
        receiver TEXT,
        salt TEXT,
        signature TEXT,
        size TEXT NOT NULL,
        remaining_size TEXT NOT NULL,
        trigger_count INTEGER DEFAULT 0,
        next_trigger_value TEXT,
        trigger_price REAL,
        filled_amount TEXT DEFAULT '0',
        created_at INTEGER NOT NULL,
        executed_at INTEGER,
        cancelled_at INTEGER,
        tx_hash TEXT,
        network INTEGER NOT NULL,
        expiry INTEGER,
        user_signed_payload TEXT,
        one_inch_order_hashes TEXT, -- JSON array of order hashes
        raw_data TEXT NOT NULL -- Complete JSON serialized Order object
      )
    `);

    // Order events table
    this.db.run(`
      CREATE TABLE IF NOT EXISTS order_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id TEXT NOT NULL,
        order_hash TEXT,
        type TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        tx_hash TEXT,
        filled_amount TEXT,
        remaining_amount TEXT,
        gas_used TEXT,
        error TEXT,
        FOREIGN KEY (order_id) REFERENCES orders(id)
      )
    `);

    // Positions table
    this.db.run(`
      CREATE TABLE IF NOT EXISTS positions (
        id TEXT PRIMARY KEY,
        strategy_id TEXT NOT NULL,
        symbol TEXT NOT NULL,
        side TEXT NOT NULL,
        entry_price REAL NOT NULL,
        current_price REAL,
        size TEXT NOT NULL,
        size_usd REAL NOT NULL,
        pnl REAL,
        pnl_percent REAL,
        opened_at INTEGER NOT NULL,
        closed_at INTEGER
      )
    `);

    // Strategies table
    this.db.run(`
      CREATE TABLE IF NOT EXISTS strategies (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        status TEXT NOT NULL,
        network INTEGER NOT NULL,
        enabled INTEGER NOT NULL,
        config TEXT NOT NULL,
        started_at INTEGER,
        paused_at INTEGER,
        stopped_at INTEGER,
        order_count INTEGER DEFAULT 0,
        filled_count INTEGER DEFAULT 0,
        total_volume TEXT DEFAULT '0',
        pnl REAL DEFAULT 0,
        pnl_percent REAL DEFAULT 0
      )
    `);

    // Market data cache table
    this.db.run(`
      CREATE TABLE IF NOT EXISTS market_data (
        symbol TEXT PRIMARY KEY,
        data TEXT NOT NULL,
        updated_at INTEGER NOT NULL,
        expires_at INTEGER NOT NULL
      )
    `);

    // Token decimals cache table
    this.db.run(`
      CREATE TABLE IF NOT EXISTS token_decimals (
        chain_id INTEGER NOT NULL,
        token_address TEXT NOT NULL,
        decimals INTEGER NOT NULL,
        cached_at INTEGER NOT NULL,
        expires_at INTEGER NOT NULL,
        PRIMARY KEY (chain_id, token_address)
      )
    `);

    // Create performance-critical indexes for maximum retrieval speed
    this.db.run(
      `CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status)`,
    );
    this.db.run(`CREATE INDEX IF NOT EXISTS idx_orders_maker ON orders(maker)`);
    this.db.run(
      `CREATE INDEX IF NOT EXISTS idx_orders_hash ON orders(order_hash)`,
    );
    this.db.run(
      `CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC)`,
    );
    this.db.run(
      `CREATE INDEX IF NOT EXISTS idx_orders_status_created ON orders(status, created_at DESC)`,
    );
    this.db.run(
      `CREATE INDEX IF NOT EXISTS idx_orders_maker_created ON orders(maker, created_at DESC)`,
    );
    this.db.run(
      `CREATE INDEX IF NOT EXISTS idx_orders_maker_status ON orders(maker, status)`,
    );
    this.db.run(
      `CREATE INDEX IF NOT EXISTS idx_orders_strategy ON orders(strategy_id)`,
    );
    this.db.run(`CREATE INDEX IF NOT EXISTS idx_orders_type ON orders(type)`);
    this.db.run(
      `CREATE INDEX IF NOT EXISTS idx_order_events_order ON order_events(order_id)`,
    );
    this.db.run(
      `CREATE INDEX IF NOT EXISTS idx_positions_strategy ON positions(strategy_id)`,
    );
    this.db.run(
      `CREATE INDEX IF NOT EXISTS idx_positions_status ON positions(closed_at)`,
    );
    this.db.run(
      `CREATE INDEX IF NOT EXISTS idx_token_decimals ON token_decimals(chain_id, token_address)`,
    );
  }

  private setupOptimizations() {
    // SQLite performance optimizations
    this.db.run("PRAGMA journal_mode = WAL"); // Write-Ahead Logging for better concurrency
    this.db.run("PRAGMA synchronous = NORMAL"); // Balance between safety and speed
    this.db.run("PRAGMA cache_size = 10000"); // 10MB cache
    this.db.run("PRAGMA temp_store = MEMORY"); // Store temp data in memory
    this.db.run("PRAGMA mmap_size = 268435456"); // 256MB memory-mapped I/O
    this.db.run("PRAGMA optimize"); // Run query planner optimizations
  }

  private prepareCriticalStatements() {
    // Pre-compile frequently used statements for better performance
    // Note: Prepared statements are built dynamically, not used for complex inserts

    this.preparedStatements.set(
      "getOrder",
      this.db.prepare(`
      SELECT raw_data FROM orders WHERE id = ?
    `),
    );

    this.preparedStatements.set(
      "getActiveOrders",
      this.db.prepare(`
      SELECT raw_data FROM orders 
      WHERE status IN ('PENDING', 'SUBMITTED', 'ACTIVE', 'PARTIALLY_FILLED')
      ORDER BY created_at DESC
    `),
    );

    this.preparedStatements.set(
      "getOrdersByMaker",
      this.db.prepare(`
      SELECT raw_data FROM orders 
      WHERE maker = ? 
      ORDER BY created_at DESC
    `),
    );

    this.preparedStatements.set(
      "getPendingOrders",
      this.db.prepare(`
      SELECT raw_data FROM orders 
      WHERE status = 'PENDING'
      ORDER BY created_at ASC
    `),
    );

    this.preparedStatements.set(
      "insertOrderEvent",
      this.db.prepare(`
      INSERT INTO order_events (
        order_id, order_hash, type, timestamp,
        tx_hash, filled_amount, remaining_amount, gas_used, error
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `),
    );
  }

  async saveOrder(order: Order): Promise<void> {
    const stmt = this.db.prepare(`
    INSERT OR REPLACE INTO orders (
      id, order_hash, strategy_id, type, status,
      maker_asset, taker_asset, making_amount, taking_amount,
      maker, receiver, salt, signature, size, remaining_size,
      trigger_count, next_trigger_value, trigger_price,
      filled_amount, created_at, executed_at, cancelled_at, tx_hash,
      network, expiry, one_inch_order_hashes, raw_data
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

    const makingAmount = order.params?.makingAmount?.toString() || "0";
    const takingAmount = order.params?.takingAmount?.toString() || "0";
    const remainingMakerAmount = order.remainingMakerAmount || 0;

    stmt.run(
      order.id,
      order.orderHash || null,
      order.strategyId || null,
      order.params?.type || "UNKNOWN",
      order.status,
      order.params?.makerAsset || "",
      order.params?.takerAsset || "",
      makingAmount, // Ensure this is never null
      takingAmount, // Ensure this is never null
      order.params?.maker || "",
      order.params?.receiver || null,
      order.params?.salt || null,
      order.signature || null,
      makingAmount, // Use makingAmount as size for compatibility
      remainingMakerAmount.toString(),
      order.triggerCount || 0,
      order.nextTriggerValue ? String(order.nextTriggerValue) : null,
      order.triggerPrice ? String(order.triggerPrice) : null,
      order.filledAmount || "0",
      order.createdAt,
      order.executedAt || null,
      order.cancelledAt || null,
      order.txHash || null,
      1, // Default to Ethereum mainnet
      order.params?.expiry || null,
      order.oneInchOrderHashes
        ? JSON.stringify(order.oneInchOrderHashes)
        : null,
      JSON.stringify(order), // Complete order object for reliable reconstruction
    );

    logger.debug(
      `Saved order ${order.id} with makingAmount: ${makingAmount}, takingAmount: ${takingAmount}`,
    );
  }
  async getOrder(id: string): Promise<Order | null> {
    const stmt = this.preparedStatements.get("getOrder");
    const result = stmt.get(id) as { raw_data: string } | null;
    return result ? JSON.parse(result.raw_data) : null;
  }

  async getOrderByHash(hash: string): Promise<Order | null> {
    const stmt = this.db.prepare(
      `SELECT raw_data FROM orders WHERE order_hash = ?`,
    );
    const result = stmt.get(hash) as { raw_data: string } | null;
    return result ? JSON.parse(result.raw_data) : null;
  }

  async getOrdersByStrategy(strategyId: string): Promise<Order[]> {
    const stmt = this.db.prepare(`
      SELECT raw_data FROM orders 
      WHERE strategy_id = ? 
      ORDER BY created_at DESC
    `);
    const results = stmt.all(strategyId) as { raw_data: string }[];
    return results.map((r) => JSON.parse(r.raw_data));
  }

  async getActiveOrders(): Promise<Order[]> {
    const stmt = this.preparedStatements.get("getActiveOrders");
    const results = stmt.all() as { raw_data: string }[];
    return results.map((r) => JSON.parse(r.raw_data));
  }

  async getOrdersByMaker(makerAddress: string): Promise<Order[]> {
    const stmt = this.preparedStatements.get("getOrdersByMaker");
    const results = stmt.all(makerAddress.toLowerCase()) as {
      raw_data: string;
    }[];
    return results.map((r) => JSON.parse(r.raw_data));
  }

  async getPendingOrders(): Promise<Order[]> {
    const stmt = this.preparedStatements.get("getPendingOrders");
    const results = stmt.all() as { raw_data: string }[];
    return results.map((r) => JSON.parse(r.raw_data));
  }

  // Order event methods
  async saveOrderEvent(event: OrderEvent): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT INTO order_events (
        order_id, order_hash, type, timestamp,
        tx_hash, filled_amount, remaining_amount,
        gas_used, error
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      event.orderId,
      event.orderHash || null,
      event.status, // Use status instead of type
      event.timestamp,
      event.txHash || null,
      event.filledAmount || null,
      event.remainingAmount || null,
      event.gasUsed || null,
      event.error || null,
    );

    logger.debug(`Saved order event for ${event.orderId}`);
  }

  async getOrderEvents(orderId: string): Promise<OrderEvent[]> {
    const stmt = this.db.prepare(`
      SELECT 
        order_id as orderId,
        order_hash as orderHash,
        type as status,
        timestamp,
        tx_hash as txHash,
        filled_amount as filledAmount,
        remaining_amount as remainingAmount,
        gas_used as gasUsed,
        error
      FROM order_events 
      WHERE order_id = ? 
      ORDER BY timestamp DESC
    `);
    return stmt.all(orderId) as OrderEvent[];
  }

  // Position methods
  async savePosition(position: Position): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO positions (
        id, strategy_id, symbol, side, entry_price,
        current_price, size, size_usd, pnl, pnl_percent,
        opened_at, closed_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      position.id,
      position.strategyId,
      position.symbol,
      position.side,
      position.entryPrice,
      position.currentPrice || null,
      position.size,
      position.sizeUsd,
      position.pnl || null,
      position.pnlPercent || null,
      position.openedAt,
      position.closedAt || null,
    );

    logger.debug(`Saved position ${position.id}`);
  }

  async getPosition(id: string): Promise<Position | null> {
    const stmt = this.db.prepare(`SELECT * FROM positions WHERE id = ?`);
    return stmt.get(id) as Position | null;
  }

  async getOpenPositions(strategyId?: string): Promise<Position[]> {
    let query = `SELECT * FROM positions WHERE closed_at IS NULL`;
    const params: any[] = [];

    if (strategyId) {
      query += ` AND strategy_id = ?`;
      params.push(strategyId);
    }

    query += ` ORDER BY opened_at DESC`;

    const stmt = this.db.prepare(query);
    return stmt.all(...params) as Position[];
  }

  // Strategy methods
  async saveStrategy(strategy: Strategy): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO strategies (
        id, name, type, status, network, enabled, config,
        started_at, paused_at, stopped_at, order_count,
        filled_count, total_volume, pnl, pnl_percent
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      strategy.id,
      strategy.name,
      strategy.type,
      strategy.status,
      strategy.network,
      strategy.enabled ? 1 : 0,
      JSON.stringify(strategy),
      strategy.startedAt || null,
      strategy.pausedAt || null,
      strategy.stoppedAt || null,
      strategy.orderCount || 0,
      strategy.filledCount || 0,
      strategy.totalVolume || "0",
      strategy.pnl || 0,
      strategy.pnlPercent || 0,
    );

    logger.debug(`Saved strategy ${strategy.id}`);
  }

  async getStrategy(id: string): Promise<Strategy | null> {
    const stmt = this.db.prepare(`SELECT config FROM strategies WHERE id = ?`);
    const result = stmt.get(id) as { config: string } | null;
    return result ? JSON.parse(result.config) : null;
  }

  async getActiveStrategies(): Promise<Strategy[]> {
    const stmt = this.db.prepare(`
      SELECT config FROM strategies 
      WHERE status = 'Running' AND enabled = 1
    `);
    const results = stmt.all() as { config: string }[];
    return results.map((r) => JSON.parse(r.config));
  }

  async getAllStrategies(): Promise<Strategy[]> {
    const stmt = this.db.prepare(`SELECT config FROM strategies`);
    const results = stmt.all() as { config: string }[];
    return results.map((r) => JSON.parse(r.config));
  }

  // Market data cache methods
  async cacheTicker(
    symbol: string,
    data: TickerFeed | AggregatedTicker,
    ttl?: number,
  ): Promise<void> {
    const expiresAt = Date.now() + (ttl || this.config.defaultTtl) * 1000;

    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO market_data (symbol, data, updated_at, expires_at)
      VALUES (?, ?, ?, ?)
    `);

    stmt.run(symbol, JSON.stringify(data), Date.now(), expiresAt);
    logger.debug(`Cached ticker data for ${symbol}`);
  }

  async getCachedTicker(
    symbol: string,
  ): Promise<TickerFeed | AggregatedTicker | null> {
    const stmt = this.db.prepare(`
      SELECT data FROM market_data 
      WHERE symbol = ? AND expires_at > ?
    `);

    const result = stmt.get(symbol, Date.now()) as { data: string } | null;
    return result ? JSON.parse(result.data) : null;
  }

  async cleanExpiredCache(): Promise<void> {
    const stmt = this.db.prepare(
      `DELETE FROM market_data WHERE expires_at < ?`,
    );
    const result = stmt.run(Date.now());
    if (result.changes > 0) {
      logger.info(`Cleaned ${result.changes} expired cache entries`);
    }
  }

  // Token decimals methods
  async cacheTokenDecimals(
    chainId: number,
    tokenAddress: string,
    decimals: number,
    ttl: number = 86400, // 24 hours default
  ): Promise<void> {
    const expiresAt = Date.now() + ttl * 1000;
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO token_decimals (chain_id, token_address, decimals, cached_at, expires_at)
      VALUES (?, ?, ?, ?, ?)
    `);

    stmt.run(
      chainId,
      tokenAddress.toLowerCase(),
      decimals,
      Date.now(),
      expiresAt,
    );
    logger.debug(
      `Cached decimals for token ${tokenAddress} on chain ${chainId}: ${decimals}`,
    );
  }

  async getCachedTokenDecimals(
    chainId: number,
    tokenAddress: string,
  ): Promise<number | null> {
    const stmt = this.db.prepare(`
      SELECT decimals FROM token_decimals 
      WHERE chain_id = ? AND token_address = ? AND expires_at > ?
    `);

    const result = stmt.get(
      chainId,
      tokenAddress.toLowerCase(),
      Date.now(),
    ) as { decimals: number } | null;
    return result?.decimals ?? null;
  }

  close() {
    this.db.close();
  }
}

// Export singleton instance
let storageInstance: StorageService | null = null;

export function initStorage(config: Config["storage"]) {
  if (!storageInstance) {
    storageInstance = new StorageService(config);
  }
  return storageInstance;
}

export function getStorage(): StorageService {
  if (!storageInstance) {
    throw new Error("Storage not initialized. Call initStorage first.");
  }
  return storageInstance;
}

// Export convenience methods
export const saveOrder = (order: Order) => getStorage().saveOrder(order);
export const getOrder = (id: string) => getStorage().getOrder(id);
export const getOrderByHash = (hash: string) =>
  getStorage().getOrderByHash(hash);
export const getOrdersByStrategy = (strategyId: string) =>
  getStorage().getOrdersByStrategy(strategyId);
export const getActiveOrders = () => getStorage().getActiveOrders();
export const getOrdersByMaker = (makerAddress: string) =>
  getStorage().getOrdersByMaker(makerAddress);
export const getPendingOrders = () => getStorage().getPendingOrders();
export const saveOrderEvent = (event: OrderEvent) =>
  getStorage().saveOrderEvent(event);
export const getOrderEvents = (orderId: string) =>
  getStorage().getOrderEvents(orderId);
export const savePosition = (position: Position) =>
  getStorage().savePosition(position);
export const getPosition = (id: string) => getStorage().getPosition(id);
export const getOpenPositions = (strategyId?: string) =>
  getStorage().getOpenPositions(strategyId);
export const saveStrategy = (strategy: Strategy) =>
  getStorage().saveStrategy(strategy);
export const getStrategy = (id: string) => getStorage().getStrategy(id);
export const getActiveStrategies = () => getStorage().getActiveStrategies();
export const getAllStrategies = () => getStorage().getAllStrategies();
export const cacheTicker = (
  symbol: string,
  data: TickerFeed | AggregatedTicker,
  ttl?: number,
) => getStorage().cacheTicker(symbol, data, ttl);
export const getCachedTicker = (symbol: string) =>
  getStorage().getCachedTicker(symbol);
export const cacheTokenDecimals = (
  chainId: number,
  tokenAddress: string,
  decimals: number,
  ttl?: number,
) => getStorage().cacheTokenDecimals(chainId, tokenAddress, decimals, ttl);
export const getCachedTokenDecimals = (chainId: number, tokenAddress: string) =>
  getStorage().getCachedTokenDecimals(chainId, tokenAddress);
