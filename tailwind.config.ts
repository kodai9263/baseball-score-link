import type { Config } from "tailwindcss";

// 色はすべて globals.css の CSS 変数を参照する。
// 意味ベースの名前だけを公開し、将来ダークモードを足すときは CSS 変数側だけを差し替えられるようにする。
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  future: {
    // タップ後に hover のスタイルが残らないよう、hover: を hover 可能なポインタだけに適用する
    hoverOnlyWhenSupported: true
  },
  theme: {
    extend: {
      colors: {
        page: "var(--color-page)",
        surface: "var(--color-surface)",
        sunken: "var(--color-sunken)",
        ink: "var(--color-ink)",
        muted: "var(--color-muted)",
        line: "var(--color-line)",
        primary: {
          DEFAULT: "var(--color-primary)",
          dark: "var(--color-primary-dark)",
          soft: "var(--color-primary-soft)"
        },
        action: {
          DEFAULT: "var(--color-action)",
          hover: "var(--color-action-hover)"
        },
        danger: "var(--color-danger)"
      },
      fontFamily: {
        sans: ["var(--font-sans)"],
        mono: ["var(--font-mono)"]
      },
      borderRadius: {
        card: "14px",
        control: "11px"
      },
      boxShadow: {
        // 影は弱く2段階まで。面の区切りは基本的に枠線で行う
        card: "0 1px 2px rgba(23, 32, 51, 0.05)",
        raised: "0 -2px 12px rgba(23, 32, 51, 0.10)"
      }
    }
  },
  plugins: []
};

export default config;
