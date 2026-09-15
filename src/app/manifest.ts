import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "スコア連携アプリ",
    short_name: "スコア連携",
    description: "少年野球チーム向けのスコア入力・ライブ共有・紙スコア清書アプリ",
    start_url: "/",
    display: "standalone",
    background_color: "#f8fafc",
    theme_color: "#173f2a",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
      {
        src: "/apple-icon.png",
        sizes: "180x180",
        type: "image/png",
        purpose: "any",
      },
    ],
  };
}
