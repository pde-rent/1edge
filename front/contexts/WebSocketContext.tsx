import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';

interface WebSocketMessage {
  type: string;
  symbol?: string;
  data?: any;
  [key: string]: any;
}

interface WebSocketContextType {
  isConnected: boolean;
  subscribe: (symbols: string[], callback: (message: WebSocketMessage) => void) => void;
  unsubscribe: (symbols: string[], callback?: (message: WebSocketMessage) => void) => void;
  reconnectAttempts: number;
  maxReconnectAttempts: number;
}

const WebSocketContext = createContext<WebSocketContextType | null>(null);

interface WebSocketProviderProps {
  children: React.ReactNode;
  url: string;
}

export function WebSocketProvider({ children, url }: WebSocketProviderProps) {
  const [isConnected, setIsConnected] = useState(false);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const subscribersRef = useRef<Map<string, Set<(message: WebSocketMessage) => void>>>(new Map());
  const subscribedSymbols = useRef<Set<string>>(new Set());

  const maxReconnectAttempts = 10;
  const reconnectInterval = 3000;

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    try {
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        setIsConnected(true);
        setReconnectAttempts(0);

        // Re-subscribe to all symbols after reconnection
        if (subscribedSymbols.current.size > 0) {
          ws.send(JSON.stringify({
            type: 'subscribe',
            symbols: Array.from(subscribedSymbols.current)
          }));
        }
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          // Notify all subscribers for this message type/symbol
          const messageKey = message.symbol || message.type;
          const callbacks = subscribersRef.current.get(messageKey);
          if (callbacks && callbacks.size > 0) {
            callbacks.forEach(callback => {
              try {
                callback(message);
              } catch (error) {
                console.error('Error in WebSocket callback:', error);
              }
            });
          } else {
            console.log(`No callbacks found for ${messageKey}`);
          }

          // Also notify generic subscribers
          const genericCallbacks = subscribersRef.current.get('*');
          genericCallbacks?.forEach(callback => {
            try {
              callback(message);
            } catch (error) {
              console.error('Error in WebSocket generic callback:', error);
            }
          });
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      };

      ws.onclose = () => {
        setIsConnected(false);

        // Attempt to reconnect if under max attempts
        setReconnectAttempts(prev => {
          if (prev < maxReconnectAttempts) {
            reconnectTimeoutRef.current = setTimeout(() => {
              connect();
            }, reconnectInterval);
            return prev + 1;
          }
          return prev;
        });
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
      };
    } catch (error) {
      console.error('Failed to create WebSocket connection:', error);
    }
  }, [url]);

  const subscribe = useCallback((symbols: string[], callback: (message: WebSocketMessage) => void) => {
    console.log('WebSocket subscribe called with symbols:', symbols);
    symbols.forEach(symbol => {
      if (!subscribersRef.current.has(symbol)) {
        subscribersRef.current.set(symbol, new Set());
      }
      subscribersRef.current.get(symbol)!.add(callback);
      subscribedSymbols.current.add(symbol);
    });

    // Send subscription to server if connected
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      console.log('Sending subscription to server for symbols:', symbols);
      wsRef.current.send(JSON.stringify({
        type: 'subscribe',
        symbols: symbols
      }));
    } else {
      console.log('WebSocket not connected, subscription will be sent when connected');
    }
  }, []);

  const unsubscribe = useCallback((symbols: string[], callback?: (message: WebSocketMessage) => void) => {
    symbols.forEach(symbol => {
      const callbacks = subscribersRef.current.get(symbol);
      if (callbacks) {
        if (callback) {
          callbacks.delete(callback);
          if (callbacks.size === 0) {
            subscribersRef.current.delete(symbol);
            subscribedSymbols.current.delete(symbol);
          }
        } else {
          subscribersRef.current.delete(symbol);
          subscribedSymbols.current.delete(symbol);
        }
      }
    });

    // Send unsubscription to server if connected
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'unsubscribe',
        symbols: symbols
      }));
    }
  }, []);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    setIsConnected(false);
    setReconnectAttempts(0);
  }, []);

  useEffect(() => {
    connect();

    return () => {
      disconnect();
    };
  }, [url]);

  const value: WebSocketContextType = {
    isConnected,
    subscribe,
    unsubscribe,
    reconnectAttempts,
    maxReconnectAttempts,
  };

  return (
    <WebSocketContext.Provider value={value}>
      {children}
    </WebSocketContext.Provider>
  );
}

export function useWebSocketContext() {
  const context = useContext(WebSocketContext);
  if (!context) {
    throw new Error('useWebSocketContext must be used within a WebSocketProvider');
  }
  return context;
}
