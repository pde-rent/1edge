/**
 * API configuration for frontend
 * Centralizes all API endpoints and URLs
 */

// Base URLs from environment variables with fallbacks
export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:40005";
export const WS_BASE_URL =
  process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:40007";

// API Endpoints
export const API_ENDPOINTS = {
  // Orders
  ORDERS: `${API_BASE_URL}/orders`,
  CANCEL_ORDER: (orderId: string) => `${API_BASE_URL}/orders/${orderId}/cancel`,

  // Strategies
  STRATEGIES: `${API_BASE_URL}/strategies`,

  // Orderbook
  ORDERBOOK: (chainId: number, makerToken: string, takerToken: string) =>
    `${API_BASE_URL}/orderbook/${chainId}/${makerToken}/${takerToken}`,

  // WebSocket
  WS_ENDPOINT: `${WS_BASE_URL}/ws`,
} as const;

// Helper to get API URL for server-side usage (Next.js API routes)
export const getServerApiUrl = () => {
  return process.env.API_URL || API_BASE_URL;
};
