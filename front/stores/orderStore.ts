import { create } from "zustand";
import { devtools, persist } from "zustand/middleware";
import { FormData } from "../components/Form/helpers"; // Import your FormData type

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
  stopPrice?: string;
  limitPrice?: string;
  distancePct?: string;
  maxPrice?: string;
  startDate?: string;
  endDate?: string;
  interval?: string;
  stepPct?: string;
  currentPair: string;
  makerAsset: string; // Address
  takerAsset: string; // Address
}

interface OrderStore {
  orderDefaults: OrderDefaults | null;

  // Current form state sync
  currentFormData: Partial<FormData> | null;
  currentOrderType: string | null;

  // Trading pair info
  currentPair: string;
  makerAsset: string; // Address
  takerAsset: string; // Address

  setOrderDefaults: (defaults: OrderDefaults) => void;
  clearOrderDefaults: () => void;

  // Form sync methods
  updateFormData: (formData: Partial<FormData>) => void;
  setCurrentOrderType: (orderType: string) => void;
  clearFormData: () => void;

  // Trading pair methods
  setPairInfo: (pair: string, makerAsset: string, takerAsset: string) => void;

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
        currentFormData: null,
        currentOrderType: null,
        currentPair: "",
        makerAsset: "",
        takerAsset: "",
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
              currentPair: defaults.currentPair,
              makerAsset: defaults.makerAsset,
              takerAsset: defaults.takerAsset,
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

        // Form sync methods
        updateFormData: (formData) => {
          const state = get();
          set(
            {
              currentFormData: {
                ...state.currentFormData,
                ...formData,
              },
            },
            false,
            "updateFormData",
          );
        },

        setCurrentOrderType: (orderType) => {
          set(
            {
              currentOrderType: orderType,
            },
            false,
            "setCurrentOrderType",
          );
        },

        clearFormData: () => {
          set(
            {
              currentFormData: null,
              currentOrderType: null,
            },
            false,
            "clearFormData",
          );
        },

        // Trading pair methods
        setPairInfo: (pair, makerAsset, takerAsset) => {
          set(
            {
              currentPair: pair,
              makerAsset,
              takerAsset,
            },
            false,
            "setPairInfo",
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
          currentPair: state.currentPair,
          makerAsset: state.makerAsset,
          takerAsset: state.takerAsset,
        }),
      },
    ),
    {
      name: "order-store",
    },
  ),
);
