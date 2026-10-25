import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        page: "var(--color-page)",
        surface: {
          DEFAULT: "var(--color-surface)",
          sunken: "var(--color-surface-sunken)",
          dim: "var(--color-surface-dim)",
          bright: "var(--color-surface-bright)",
        },
        border: {
          DEFAULT: "var(--color-border)",
          strong: "var(--color-border-strong)",
        },
        text: {
          DEFAULT: "var(--color-text)",
          muted: "var(--color-text-muted)",
          subtle: "var(--color-text-subtle)",
        },
        primary: {
          DEFAULT: "var(--color-primary)",
          hover: "var(--color-primary-hover)",
          pressed: "var(--color-primary-pressed)",
          tint: "var(--color-primary-tint)",
          on: "var(--color-on-primary)",
        },
        danger: {
          DEFAULT: "var(--color-danger)",
          tint: "var(--color-danger-tint)",
        },
        ai: {
          DEFAULT: "var(--color-ai)",
          tint: "var(--color-ai-tint)",
        },
        secondary: "var(--color-secondary)",
        status: {
          "open-text": "var(--status-open-text)",
          "open-bg": "var(--status-open-bg)",
          "progress-text": "var(--status-progress-text)",
          "progress-bg": "var(--status-progress-bg)",
          "resolved-text": "var(--status-resolved-text)",
          "resolved-bg": "var(--status-resolved-bg)",
          "closed-text": "var(--status-closed-text)",
          "closed-bg": "var(--status-closed-bg)",
        },
        priority: {
          "critical-text": "var(--priority-critical-text)",
          "critical-bg": "var(--priority-critical-bg)",
          "high-text": "var(--priority-high-text)",
          "high-bg": "var(--priority-high-bg)",
          "medium-text": "var(--priority-medium-text)",
          "medium-bg": "var(--priority-medium-bg)",
          "low-text": "var(--priority-low-text)",
          "low-border": "var(--priority-low-border)",
        },
        book: {
          "live-text": "var(--book-live-text)",
          "live-bg": "var(--book-live-bg)",
          "prod-text": "var(--book-prod-text)",
          "prod-bg": "var(--book-prod-bg)",
        },
      },
      fontFamily: {
        serif: ["var(--font-literata)", "Georgia", "Cambria", "serif"],
        sans: [
          "var(--font-ibm-plex)",
          "var(--font-ibm-plex-sans)",
          "system-ui",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "Roboto",
          "sans-serif",
        ],
        mono: ["var(--font-ibm-plex)", "ui-monospace", "monospace"],
      },
      fontSize: {
        "title-page": ["28px", { lineHeight: "36px", fontWeight: "600" }],
        "title-page-mobile": ["24px", { lineHeight: "32px", fontWeight: "600" }],
        "title-section": ["20px", { lineHeight: "28px", fontWeight: "600" }],
        "title-book": ["18px", { lineHeight: "26px", fontWeight: "600" }],
        "body-lg": ["16px", { lineHeight: "26px", fontWeight: "400" }],
        "body": ["14px", { lineHeight: "22px", fontWeight: "400" }],
        "label": ["14px", { lineHeight: "20px", fontWeight: "500" }],
        "caption": ["13px", { lineHeight: "18px", fontWeight: "400" }],
        "figure": ["15px", { lineHeight: "22px", fontWeight: "500" }],
        "figure-lg": ["20px", { lineHeight: "28px", fontWeight: "500" }],
      },
      borderRadius: {
        sm: "4px",
        md: "6px",
        lg: "10px",
        xl: "10px",
      },
      spacing: {
        1: "4px",
        2: "8px",
        3: "12px",
        4: "16px",
        5: "24px",
        6: "32px",
        7: "48px",
        8: "64px",
      },
      maxWidth: {
        author: "1040px",
        admin: "1320px",
        ticket: "760px",
        form: "640px",
        login: "400px",
      },
      boxShadow: {
        overlay: "var(--shadow-overlay)",
        none: "none",
      },
    },
  },
  plugins: [
    require("@tailwindcss/forms"),
    require("@tailwindcss/container-queries"),
  ],
};

export default config;
