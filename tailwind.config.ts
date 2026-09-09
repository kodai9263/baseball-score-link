import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        field: {
          50: "#f6fbf7",
          100: "#e7f4ea",
          700: "#247044",
          900: "#173f2a"
        },
        ink: "#1e293b",
        line: "#d7dde5",
        accent: "#f97316"
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "SFMono-Regular", "monospace"]
      }
    }
  },
  plugins: []
};

export default config;
