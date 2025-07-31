import type { AppProps } from "next/app";
import "../styles/globals.css";
import "@fontsource-variable/inter";
import "../utils/fixEthereum";
import React from "react";
import type { FC } from "react";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";
import { THEME, syncThemeWithCSSVars } from "@common/constants";
import { useEffect } from "react";
import { Toaster } from "sonner";
import { WebSocketProvider } from "../contexts/WebSocketContext";

import { PrivyProvider } from "@privy-io/react-auth";
import { WagmiProvider, createConfig } from "@privy-io/wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { mainnet, sepolia, polygon, arbitrum, base } from "viem/chains";
import { http } from "wagmi";

const config = createConfig({
  chains: [mainnet, sepolia, polygon, arbitrum, base],
  transports: {
    [mainnet.id]: http(),
    [sepolia.id]: http(),
    [polygon.id]: http(),
    [arbitrum.id]: http(),
    [base.id]: http(),
  },
});

const queryClient = new QueryClient();

const privyConfig = {
  // Configure supported chains (should match wagmi chains)
  supportedChains: [mainnet, sepolia, polygon, arbitrum, base],
  // Configure login methods
  loginMethods: ["email", "wallet", "google", "twitter", "discord"] as const,
  // Configure embedded wallet
  embeddedWallets: {
    createOnLogin: "users-without-wallets" as const,
    requireUserPasswordOnCreate: false,
  },
  // Configure external wallet connection
  externalWallets: {
    coinbaseWallet: {
      // Replace with your app's URL
      connectionOptions: "smartWalletOnly" as const,
    },
  },
};

const darkTheme = createTheme({
  palette: {
    mode: "dark",
    primary: { main: THEME.primary },
    secondary: { main: THEME.secondary },
    error: { main: THEME.error },
    success: { main: THEME.success },
    background: {
      default: THEME.background.main,
      paper: THEME.background.paper,
    },
    text: {
      primary: THEME.text.primary,
      secondary: THEME.text.secondary,
    },
  },
  typography: {
    fontFamily: THEME.font.family,
  },
  shadows: [
    "none",
    "0px 2px 1px -1px rgba(0,0,0,0.1),0px 1px 1px 0px rgba(0,0,0,0.07),0px 1px 3px 0px rgba(0,0,0,0.06)",
    "0px 3px 1px -2px rgba(0,0,0,0.1),0px 2px 2px 0px rgba(0,0,0,0.07),0px 1px 5px 0px rgba(0,0,0,0.06)",
    "0px 3px 3px -2px rgba(0,0,0,0.1),0px 3px 4px 0px rgba(0,0,0,0.07),0px 1px 8px 0px rgba(0,0,0,0.06)",
    "0px 2px 4px -1px rgba(0,0,0,0.1),0px 4px 5px 0px rgba(0,0,0,0.07),0px 1px 10px 0px rgba(0,0,0,0.06)",
    "0px 3px 5px -1px rgba(0,0,0,0.1),0px 5px 8px 0px rgba(0,0,0,0.07),0px 1px 14px 0px rgba(0,0,0,0.06)",
    "0px 3px 5px -1px rgba(0,0,0,0.1),0px 6px 10px 0px rgba(0,0,0,0.07),0px 1px 18px 0px rgba(0,0,0,0.06)",
    "0px 4px 5px -2px rgba(0,0,0,0.1),0px 7px 10px 1px rgba(0,0,0,0.07),0px 2px 16px 1px rgba(0,0,0,0.06)",
    "0px 5px 5px -3px rgba(0,0,0,0.1),0px 8px 10px 1px rgba(0,0,0,0.07),0px 3px 14px 2px rgba(0,0,0,0.06)",
    "0px 5px 6px -3px rgba(0,0,0,0.1),0px 9px 12px 1px rgba(0,0,0,0.07),0px 3px 16px 2px rgba(0,0,0,0.06)",
    "0px 6px 6px -3px rgba(0,0,0,0.1),0px 10px 14px 1px rgba(0,0,0,0.07),0px 4px 18px 3px rgba(0,0,0,0.06)",
    "0px 6px 7px -4px rgba(0,0,0,0.1),0px 11px 15px 1px rgba(0,0,0,0.07),0px 4px 20px 3px rgba(0,0,0,0.06)",
    "0px 7px 8px -4px rgba(0,0,0,0.1),0px 12px 17px 2px rgba(0,0,0,0.07),0px 5px 22px 4px rgba(0,0,0,0.06)",
    "0px 7px 8px -4px rgba(0,0,0,0.1),0px 13px 19px 2px rgba(0,0,0,0.07),0px 5px 24px 4px rgba(0,0,0,0.06)",
    "0px 7px 9px -4px rgba(0,0,0,0.1),0px 14px 21px 2px rgba(0,0,0,0.07),0px 5px 26px 4px rgba(0,0,0,0.06)",
    "0px 8px 9px -5px rgba(0,0,0,0.1),0px 15px 22px 2px rgba(0,0,0,0.07),0px 6px 28px 5px rgba(0,0,0,0.06)",
    "0px 8px 10px -5px rgba(0,0,0,0.1),0px 16px 24px 2px rgba(0,0,0,0.07),0px 6px 30px 5px rgba(0,0,0,0.06)",
    "0px 8px 11px -5px rgba(0,0,0,0.1),0px 17px 26px 2px rgba(0,0,0,0.07),0px 6px 32px 5px rgba(0,0,0,0.06)",
    "0px 9px 11px -5px rgba(0,0,0,0.1),0px 18px 28px 2px rgba(0,0,0,0.07),0px 7px 34px 6px rgba(0,0,0,0.06)",
    "0px 9px 12px -6px rgba(0,0,0,0.1),0px 19px 29px 2px rgba(0,0,0,0.07),0px 7px 36px 6px rgba(0,0,0,0.06)",
    "0px 10px 13px -6px rgba(0,0,0,0.1),0px 20px 31px 3px rgba(0,0,0,0.07),0px 8px 38px 7px rgba(0,0,0,0.06)",
    "0px 10px 13px -6px rgba(0,0,0,0.1),0px 21px 33px 3px rgba(0,0,0,0.07),0px 8px 40px 7px rgba(0,0,0,0.06)",
    "0px 10px 14px -6px rgba(0,0,0,0.1),0px 22px 35px 3px rgba(0,0,0,0.07),0px 8px 42px 7px rgba(0,0,0,0.06)",
    "0px 11px 14px -7px rgba(0,0,0,0.1),0px 23px 36px 3px rgba(0,0,0,0.07),0px 9px 44px 8px rgba(0,0,0,0.06)",
    "0px 11px 15px -7px rgba(0,0,0,0.1),0px 24px 38px 3px rgba(0,0,0,0.07),0px 9px 46px 8px rgba(0,0,0,0.06)",
  ],
  components: {
    MuiTooltip: {
      styleOverrides: {
        tooltip: {
          backgroundColor: THEME.background.paper,
          color: THEME.text.primary,
          border: `1px solid ${THEME.border}`,
          boxShadow: "0px 2px 4px rgba(0,0,0,0.15)",
          fontSize: "0.75rem",
          padding: "8px 12px",
        },
      },
    },
    MuiPopover: {
      styleOverrides: {
        paper: {
          backgroundColor: THEME.background.paper,
          color: THEME.text.primary,
          border: `1px solid ${THEME.border}`,
          boxShadow: "0px 2px 4px rgba(0,0,0,0.15)",
        },
      },
    },
    MuiMenu: {
      styleOverrides: {
        paper: {
          backgroundColor: THEME.background.paper,
          color: THEME.text.primary,
          border: `1px solid ${THEME.border}`,
          boxShadow: "0px 2px 4px rgba(0,0,0,0.15)",
        },
      },
    },
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          backgroundColor: THEME.background.main,
          color: THEME.text.primary,
        },
      },
    },
  },
});

/**
 * Custom App component for Next.js with Privy + Wagmi integration.
 * Sets up the MUI theme, Privy authentication, and Wagmi for Web3 functionality.
 * @param Component - The active page component
 * @param pageProps - Props for the active page
 */
const App: FC<AppProps> = ({ Component, pageProps }) => {
  // Sync MUI theme with CSS variables
  useEffect(() => {
    syncThemeWithCSSVars();
  }, []);

  return (
    <PrivyProvider
      appId={process.env.NEXT_PUBLIC_PRIVY_APP_ID as string}
      config={privyConfig as any}
    >
      <QueryClientProvider client={queryClient}>
        <WagmiProvider config={config as any}>
          <ThemeProvider theme={darkTheme}>
            <CssBaseline />
            <WebSocketProvider url="ws://localhost:40007/ws">
              <Toaster
                theme="dark"
                position="top-right"
                toastOptions={{
                  style: {
                    background: THEME.background.paper,
                    color: THEME.text.primary,
                    border: `1px solid ${THEME.border}`,
                  },
                }}
              />
              <Component {...pageProps} />
            </WebSocketProvider>
          </ThemeProvider>
        </WagmiProvider>
      </QueryClientProvider>
    </PrivyProvider>
  );
};

export default App;
