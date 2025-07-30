import { create } from "zustand";
import { devtools, persist } from "zustand/middleware";

interface OrderDefaults {
  orderType: string;
  price: string;
  isBuy: boolean;
  fromCoin: string;
  toCoin: string;
  amount?: string;
  timestamp: number;
  // Iceberg specific fields
  startPrice?: string;
  endPrice?: string;
  steps?: string;
  expiry?: string;
  // Other order type fields can be added here as needed
  stopPrice?: string;
  limitPrice?: string;
  distancePct?: string;
  maxPrice?: string;
  startDate?: string;
  endDate?: string;
  interval?: string;
  stepPct?: string;
  currentPair: string;
  makerAsset: string;
  takerAsset: string;
}

interface OrderStore {
  orderDefaults: OrderDefaults | null;

  setOrderDefaults: (defaults: OrderDefaults) => void;
  clearOrderDefaults: () => void;

  isOrderFormOpen: boolean;
  setOrderFormOpen: (open: boolean) => void;

  orderSettings: {
    defaultOrderType: string;
    defaultAmount: string;
    autoFillFromOrderbook: boolean;
  };
  updateOrderSettings: (settings: any) => void;
}

export const useOrderStore = create<OrderStore>()(
  devtools(
    persist(
      (set, get) => ({
        orderDefaults: null,
        isOrderFormOpen: false,
        orderSettings: {
          defaultOrderType: "Iceberg",
          defaultAmount: "",
          autoFillFromOrderbook: true,
        },
        setOrderDefaults: (defaults) => {
          set(
            {
              orderDefaults: defaults,
              isOrderFormOpen: get().orderSettings.autoFillFromOrderbook,
            },
            false,
            "setOrderDefaults",
          );
        },

        clearOrderDefaults: () => {
          set(
            {
              orderDefaults: null,
              isOrderFormOpen: false,
            },
            false,
            "clearOrderDefaults",
          );
        },

        setOrderFormOpen: (open) => {
          set({ isOrderFormOpen: open }, false, "setOrderFormOpen");
        },

        updateOrderSettings: (newSettings) => {
          set(
            (state) => ({
              orderSettings: { ...state.orderSettings, ...newSettings },
            }),
            false,
            "updateOrderSettings",
          );
        },
      }),
      {
        name: "order-store",
        partialize: (state) => ({
          orderSettings: state.orderSettings,
        }),
      },
    ),
    {
      name: "order-store",
    },
  ),
);
