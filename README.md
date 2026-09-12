# スコア連携アプリ

少年野球チーム向けのスコア入力・紙スコア表示・個人成績アプリの開発版です。

メンバーから通算・学年別・期間別の成績を確認でき、JSONファイルでバックアップと復元ができます。初回のチーム・選手登録、メールリンクによるログイン、招待、管理者・記録者・閲覧者の権限、チーム別クラウド保存に対応しています。

本番版は [https://baseball-score-link.vercel.app](https://baseball-score-link.vercel.app) で公開しています。Supabase未設定時やログインしない場合は端末保存で動作します。クラウド運用の設定と残る確認事項は[本番接続手順](docs/cloud-setup.md)を参照してください。

公開前の確認項目は [公開準備](docs/release-readiness.md) を参照してください。

## 技術スタック

- Next.js App Router
- TypeScript
- Tailwind CSS
- Supabase

## 開発

依存関係をインストールしてから起動します。

```bash
npm ci --legacy-peer-deps
npm run dev
```

ブラウザのデータ削除や公開先URLの変更に備え、画面上部の「データのバックアップ・復元」からファイルを保管してください。クラウドが空の場合は同じURLの端末内データをコピーできます。別URLからはJSONバックアップを経由します。

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

DBのアクセス制御テストはGitHub Actionsの`cloud-db`ジョブでも実行します。手元での再現方法は[本番接続手順](docs/cloud-setup.md)に記載しています。
