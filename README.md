# Marine Wallet

マリーンズを応援する毎日を、記録し、つなぎ、未来へ積み立てる。

千葉ロッテマリーンズの観戦体験を軸に、**ロッテ貯金**と**割り勘**を1つのアプリへ統合した個人利用アプリです。
仕様は [docs/marine-wallet-spec-v0.1.md](docs/marine-wallet-spec-v0.1.md)、統合方針は
[docs/integration-plan.md](docs/integration-plan.md) を参照してください。

- 完全個人利用 / 非商用
- Marine Wallet 自身は資金を保有・移動しません（外部アプリへの誘導のみ）

## 統合元

| 旧アプリ | 旧スタック | 統合後 |
| --- | --- | --- |
| ロッテ貯金（baseball-savings） | Vite + React + Supabase | 貯金タブ |
| 割り勘アプリ（warikan-app） | Next.js + Supabase | 割り勘タブ |

## 技術スタック

- Next.js 16（App Router / Turbopack）
- React 19
- Tailwind CSS v4
- Supabase（Auth / PostgreSQL / RLS）
- Vercel

チャートは外部ライブラリを使わず SVG で自前描画しています（`components/charts/CumulativeChart.tsx`）。

## セットアップ

```bash
npm install
cp .env.example .env.local   # Supabase の URL とキーを設定する
npm run dev
```

`.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<publishable key>
```

### DBマイグレーション

Supabase の SQL Editor で以下の順に実行します（何度実行しても安全な冪等スクリプトです）。

1. `supabase/migrations/0001_marine_wallet_core.sql` … Marine Wallet の共通スキーマ
2. `supabase/migrations/0002_import_legacy_games.sql` … 旧ロッテ貯金アプリからのデータ移行（任意）

## Vercel へのデプロイ時の注意

旧 baseball-savings は Vite 構成だったため、**環境変数名が変わります**。
Vercel のプロジェクト設定で以下を差し替えてください。

| 旧（Vite） | 新（Next.js） |
| --- | --- |
| `VITE_SUPABASE_URL` | `NEXT_PUBLIC_SUPABASE_URL` |
| `VITE_SUPABASE_KEY` | `NEXT_PUBLIC_SUPABASE_ANON_KEY` |

また、Supabase プロジェクトも統合先（割り勘側）に切り替えます。Framework Preset は Next.js が自動検出されます。

## 画面構成

```
ホーム        累計貯金・前月比 / 今月のつみたて額・目標金額・継続日数 / 未精算 / 最近のアクティビティ
貯金          試合登録・カスタム貯金 / 月間集計と目標進捗 / 月末確定・ワンバンク入金 / 貯金ルール
割り勘        未精算サマリーと支払い状況 / メンバー / 精算（PayPay誘導）/ 未精算・すべて・完了
履歴          貯金推移 / 取引履歴 / 月別 / 年別
マイページ    Marine ID / 表示名 / 外部アプリ起動URL / お知らせ / ログアウト
```

## ブランドアセット

確定アイコンの置き場所は [public/brand/README.md](public/brand/README.md) を参照。
`public/brand/mark.png` が無い場合はワードマークのみを表示するため、画面は崩れない。

## 設計上のポイント

- **試合データは共有、貯金ルールは個人**（仕様書 15章）。`games` は全ユーザー共通、
  `saving_entries` がユーザーごとの積立予定額を持ちます。
- **過去の金額は再計算しない**。貯金ルールを変更しても、記録済みの試合の金額は保持されます。
- **ワンバンク入金は月末に1回**。`monthly_savings` が
  `calculating → ready → deposit_pending → deposited` の状態を管理します。
- **UIに絵文字は使わない**（仕様書 4.1）。アイコンはすべて `components/icons.tsx` の SVG ラインアイコンです。

## スクリプト

```bash
npm run dev        # 開発サーバー
npm run build      # 本番ビルド
npm run start      # 本番サーバー
npm run typecheck  # 型チェック
```
