# Marine Wallet

マリーンズを応援する毎日を、記録し、つなぎ、未来へ積み立てる。

千葉ロッテマリーンズの観戦体験を軸に、**ロッテ貯金**と**割り勘**を1つのアプリへ統合した個人利用アプリです。
仕様は [docs/marine-wallet-spec-v0.1.md](docs/marine-wallet-spec-v0.1.md)、統合方針は
[docs/integration-plan.md](docs/integration-plan.md) を参照してください。

- 完全個人利用 / 非商用
- Marine Wallet 自身は資金を保有・移動しません（外部アプリへの誘導のみ）

| | |
| --- | --- |
| リポジトリ | `minatani-01/marine-wallet`（旧 `baseball-savings` を改称） |
| 公開URL | https://marine-wallet.vercel.app |
| Vercelプロジェクト名 | `marine-wallet` |
| Supabase | Marine Wallet（ref `xliszlnpypvqghrwplxa`） |

## 統合元

| 旧アプリ | 旧スタック | 統合後 |
| --- | --- | --- |
| ロッテ貯金（baseball-savings） | Vite + React + Supabase | 貯金タブ |
| 割り勘アプリ（warikan-app） | Next.js + Supabase | 割り勘タブ |

旧アプリのリポジトリ・Vercelプロジェクト・Supabaseプロジェクトはいずれも削除または
PAUSED 済みです。データは移行済みで、旧ロッテ貯金の試合116件（合計 54,600円）と
旧割り勘の92件はすべて本アプリのDBにあります。

## 技術スタック

- Next.js 16（App Router / Turbopack / `proxy.ts`）
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

Supabase の SQL Editor で番号順に実行します（何度実行しても安全な冪等スクリプトです）。
本番プロジェクトへは適用済みで、新しく環境を作るときだけ必要になります。

| ファイル | 内容 |
| --- | --- |
| `0001_marine_wallet_core.sql` | 共通スキーマ（`profiles` / `saving_rules` / `games` / `saving_entries` / `monthly_savings`）とRLS |
| `0002_import_legacy_games.sql` | 旧ロッテ貯金アプリからのデータ移行（実施済みの記録。再実行用のクエリを含む） |
| `0003_confirmed_ui.sql` | 確定UIに合わせたボーナス項目とカスタム貯金の追加 |
| `0004_home_away_nullable.sql` | 旧アプリが未記録だったホーム/ビジターを null 許容にする |
| `0005_marine_link.sql` | Marine Link（`marine_links` / `link_permissions` / 判定関数 / RPC / 共有用ポリシー） |
| `0006_shared_goals.sql` | 共同貯金（`shared_goals` / `shared_goal_members` / 進捗RPC） |
| `0007_split_member_marine_id.sql` | メンバーの Marine ID と、参加者単位の割り勘共有 |
| `0008_member_participation.sql` | メンバーの参加機能（割り勘 / 貯金）と、貯金の参加者別集計RPC |

## デプロイ

master への push で Vercel が Production を自動デプロイします。環境変数は
`NEXT_PUBLIC_SUPABASE_URL` と `NEXT_PUBLIC_SUPABASE_ANON_KEY` の2つだけです。

`NEXT_PUBLIC_*` はビルド時にバンドルへ埋め込まれるため、**環境変数を変更したときは
ビルドキャッシュを使わずに再デプロイ**してください。変更していないときはキャッシュを
使って構いません。

ビルド設定は `vercel.json`（`framework: nextjs`）でリポジトリ側に固定しています。
旧 Vite 構成のプロジェクト設定が残っていてもこちらが優先されます。

## 画面構成

```
ホーム        累計貯金・前月比 / 今月のつみたて額・目標金額・継続日数 / 未精算 / 最近のアクティビティ
貯金          試合登録・カスタム貯金 / 月間集計と目標進捗 / 月末確定・ワンバンク入金 / 貯金ルール
割り勘        未精算サマリーと支払い状況 / メンバー / 精算（PayPay誘導）/ 未精算・すべて・完了
履歴          貯金推移 / 取引履歴 / 月別 / 年別
マイページ    Marine ID / 表示名・ログアウト / お知らせ / メンバー / Marine Link
  ├ メンバー      一緒に使う人 / Marine ID / 割り勘・貯金への参加
  └ Marine Link   接続リクエストと承認 / 接続ごとの共有権限 / 共同貯金 / 月間比較
```

## 実装状況

仕様書 40章のフェーズ区分に対応します。

| フェーズ | 状態 |
| --- | --- |
| Phase 1 統合基盤 | 実装済み |
| Phase 2 ロッテ貯金自動化 | 手動登録のみ実装。NPBからの自動取得は未着手 |
| Phase 3 外部アプリ連携 | 金額コピーと起動URLは実装済み。入金ステータスは月末フローに内包 |
| Phase 4 Marine Link | 実装済み（Marine ID / リクエスト / 権限管理 / データ共有 / 月間比較 / 共同貯金） |
| Phase 5 Marine Day | 未着手 |
| Phase 6 Insight | 履歴・推移は実装済み。Season Report / Fan Score / 通知は未着手 |

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
- **累計貯金額は確定した月だけを数える**。月末に「確定」した `monthly_savings.confirmed_amount`
  の合計で、今月のように未確定の月は含めません（未確定分は見込みとして別に扱います）。
  1人分の累計と、貯金に参加している接続済みメンバーを合算した総累計を分けて出します。
- **割り勘の共有は参加者単位**。メンバーに Marine ID を登録すると、接続済みかつ
  そのメンバーが参加している割り勘だけが相手から見えます。参加していない記録は見えません。
- **共同貯金は記録上の目標**（仕様書17章）。資金は各自のワンバンクのままで、
  達成率は確定済みの合計で見ます。相手の月次明細は読めず、`shared_goal_progress()` が
  メンバーごとの合計だけを返します。
- **共有は方向を持つ**（Marine Link）。仕様書 33章の `link_permissions` に `owner_id`
  を足し、「AがBに見せるもの」と「BがAに見せるもの」を別に持ちます。共有相手に開くのは
  SELECT だけで、書き換えの経路は作りません。判定は `marine_link_allows()` を通した
  RLS で行うため、アプリ側の実装ミスでは漏れません。
- **読み取りに失敗したら金額を表示しない**。`lib/queries.ts` は取得エラーを握りつぶさず
  `QueryError` を投げ、`app/(app)/error.tsx` が再読み込みを促します。
  Supabase の Free プランはアイドル後の初回アクセスで 504 を返すことがあるため、
  読み取りは1回だけ自動で再試行します（読み取りは冪等なので安全）。
- **認証はローカルで検証する**。`getUser()` は毎回 Auth サーバーへ往復するため、
  `proxy.ts` と `lib/queries.ts` では `getClaims()` を使い、JWT（ES256）の署名を
  JWKS でローカル検証します。サーバークライアントと `getSessionUser()` は
  React の `cache()` でリクエスト単位に共有します。
- **下部ナビをプリフェッチしない**。5タブが常に画面内にあるため、既定のままだと
  1画面開くごとに他タブぶんの RSC がサーバー描画され、そのぶんクエリも走ります。
  上の2点と合わせて、1画面あたりの Supabase 往復は 15回から4回になりました
  （本番ログで認証の往復が実測ゼロになったことを確認済み）。
- **外部アプリの起動URLは既定値を組み込む**。`lib/constants.ts` の
  `EXTERNAL_APPS[].defaultUrl` を使うため、設定なしで起動できます。設定UIは画面から外し、
  端末ごとの上書き（localStorage）は仕組みとしてだけ残してあります。
- **ログインはメール/パスワードと Google の2通り**。Google は `signInWithOAuth` →
  `/auth/callback` でセッションへ交換します。このパスは `proxy.ts` の認証ガードから
  除外してあります（除外しないと、セッションが無い状態で `/login` へ飛ばされ、
  `code` を交換する前に流れが切れます）。
  同じメールアドレスなら Supabase が既存ユーザーへ自動で紐付けます。

## スクリプト

```bash
npm run dev        # 開発サーバー
npm run build      # 本番ビルド
npm run start      # 本番サーバー
npm run typecheck  # 型チェック
```
