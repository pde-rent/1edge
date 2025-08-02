import type { Config } from "tailwindcss";
import { THEME } from "../common/constants";

const config: Config = {
  darkMode: "class",
  content: [
    "./pages/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./app/**/*.{ts,tsx}",
    "./src/**/*.{ts,tsx}",
  ],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      colors: {
        border: THEME.border,
        input: THEME.border,
        ring: THEME.primary,
        background: THEME.background.main,
        foreground: THEME.text.primary,
        primary: {
          DEFAULT: THEME.primary,
          dark: THEME.primaryVariants.dark,
          light: THEME.primaryVariants.light20,
          foreground: THEME.background.main,
        },
        secondary: {
          DEFAULT: THEME.secondary,
          foreground: THEME.background.main,
        },
        destructive: {
          DEFAULT: THEME.error,
          foreground: THEME.text.primary,
        },
        muted: {
          DEFAULT: THEME.background.paper,
          foreground: THEME.text.secondary,
        },
        accent: {
          DEFAULT: THEME.background.overlay10,
          foreground: THEME.text.primary,
        },
        popover: {
          DEFAULT: THEME.background.paper,
          foreground: THEME.text.primary,
        },
        card: {
          DEFAULT: THEME.background.paper,
          foreground: THEME.text.primary,
        },
        // Status and semantic colors
        success: {
          DEFAULT: THEME.success,
          foreground: THEME.text.primary,
        },
        warning: {
          DEFAULT: THEME.warning,
          foreground: THEME.text.primary,
        },
        // Chart colors
        "chart-up": THEME.chart.upColor,
        "chart-down": THEME.chart.downColor,
        // Custom color mappings for consistency
        blue: {
          500: THEME.primary, // Map blue-500 to primary cyan
        },
        green: {
          500: THEME.success, // Map green-500 to success color
        },
        orange: {
          500: THEME.secondary, // Map orange-500 to secondary color
        },
      },
      borderRadius: {
        lg: THEME.radius,
        md: `calc(${THEME.radius} - 2px)`,
        sm: `calc(${THEME.radius} - 4px)`,
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
