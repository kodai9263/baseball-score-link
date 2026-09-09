# スコア連携アプリ

少年野球チーム向けのスコア入力・ライブ共有・紙スコア清書アプリのMVPです。

## 技術スタック

- Next.js App Router
- TypeScript
- Tailwind CSS
- Supabase

## 開発

依存関係をインストールしてから起動します。

```bash
npm install
npm run dev
```

Supabaseに接続する場合は `.env.example` を参考に環境変数を設定します。未設定でも、現時点の画面はローカル状態のプロトタイプとして動きます。
