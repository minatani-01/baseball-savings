# Marine Wallet 統合計画

仕様書 v0.1（[marine-wallet-spec-v0.1.md](marine-wallet-spec-v0.1.md)）を実装へ落とし込むための技術判断と、
フェーズごとの進め方をまとめる。

---

## 1. 統合の前提

### 1.1 統合元

| | ロッテ貯金 | 割り勘アプリ |
| --- | --- | --- |
| リポジトリ | `minatani-01/baseball-savings` | `minatani-01/warikan-app` |
| 公開URL | baseball-savings.vercel.app | warikan-app-puce.vercel.app |
| スタック | Vite + React 18 + Supabase | Next.js 16 + React 19 + Tailwind v4 + Supabase |
| Supabase | 「千葉ロッテマリーンズ貯金」（PAUSED） | 「割り勘メモ」→ Marine Wallet へ改称（ACTIVE） |
| 主テーブル | `games`（ユーザーごと） | `records` / `settings` |

### 1.2 決めたこと

| 論点 | 判断 | 理由 |
| --- | --- | --- |
| ベースにするコード | 割り勘側のスタック（Next.js 16 / Tailwind v4 / Supabase SSR） | 仕様書39章の推奨構成と一致し、SSR認証・App Router が既に動作していたため。貯金側は画面数が少なく移植コストが低い |
| リポジトリ | `baseball-savings` を Marine Wallet 本体へ転換 | 既存の公開URLと履歴を活かせる。Vite構成（`src/`, `index.html`, `vite.config.js`）は削除した |
| Supabase | 「割り勘メモ」プロジェクトを共通DBへ拡張 | 稼働中のプロジェクトを土台にでき、既存の割り勘データ（92件）を移行せずに済む。貯金側は PAUSED で復旧が必要なため移行元とする |
| 認証 | Supabase Auth（メール/パスワード）に一本化 | 仕様書34章の推奨どおり |
| データ書き込み | クライアントから RLS 経由で直接実行 | 個人利用規模でAPIルートを二重に持つ必要がないため。整合性は DB の CHECK 制約と RLS で担保する |
| チャート | 外部ライブラリを使わず SVG 自前描画 | recharts は React 19 との組み合わせで追加検証が必要になる。トンマナ（線幅・発光）も直接制御したい |

### 1.3 確定UIへの追従（2026-09-13）

確定したUIモックに合わせて以下を実装した。

| 項目 | 内容 |
| --- | --- |
| ボーナス項目 | マルチ安打・打点・勝利投手を追加。旧アプリの満塁HR・完投・NN・完全試合も併存させ、使わない項目は貯金ルールで0円にできる |
| カスタム貯金 | `saving_entries.kind='custom'`（`game_id` は null）。フェーズ倍率も貯金ルールも適用しない |
| 目標金額 / 継続日数 / 前月比 | `saving_rules.monthly_goal_amount` と `lib/insights.ts` |
| 割り勘メンバー | `split_members` テーブルで人数無制限。記録ごとに参加メンバーを選ぶ |
| 支払い状況 / 完了タブ | 精算済み金額 ÷ 総額の進捗バーと、未精算 / すべて / 完了 の3タブ |
| 履歴 | 貯金推移 / 取引履歴 / 月別 / 年別 の4タブ |
| ヘッダー | ホームはロゴ＋通知ベル、下位階層は戻る矢印＋中央タイトル |
| ボトムナビ | 貯金=ウォレット、割り勘=2人、履歴=時計のアイコンへ差し替え |

指標の定義（モックに定義が無かったため決めたもの）:

- **継続日数**: 最初に貯金を記録した日から今日までの日数（初日を1日目とする）
- **前月比**: 当月の積立額を前月と比較した増減率。前月が0円のときは非表示
- **未精算の合計**: 未精算レコードの単純合計ではなく、**精算に必要な送金額の合計**
  （確定UIの ¥12,500 が実データの精算額と一致するため、そちらの定義を採用）
- **支払い状況**: 未精算総額のうち、立替が釣り合っていて送金不要な分の割合

### 1.4 UI方針（仕様書4章）

- ダークモード主体、Glassmorphism、細いボーダー、微細な発光、広い余白
- 基本カラー: Black / Graphite / White / Silver + Cyan・Teal アクセント
- **絵文字は一切使わない**。アイコンは `components/icons.tsx` の単色SVGラインアイコンに統一
- 数値は `tabular-nums`（`.tnum`）で桁を揃える。英字ラベルは `.eyebrow` でトラッキングを効かせる

---

## 2. データモデル

仕様書31章のテーブル一覧のうち、Phase 1〜3 で実際に使うものだけを作成した。
未使用のテーブルは先に作らず、各フェーズで追加する。

```
profiles          Marine ID（MW-XXXXXX）と表示名
saving_rules      貯金ルール（ユーザーごと）
games             試合データ（全ユーザー共有）
saving_entries    試合 × ユーザーの積立予定額（内訳を jsonb で保持）
monthly_savings   月末確定とワンバンク入金の状態
records           割り勘（既存 / category・game_id を追加）
settings          割り勘メンバー（既存）
```

### 2.1 「試合結果は共有、貯金ルールは個人」

仕様書15章の原則をそのままスキーマにした。

```
games（共有）
  └─ saving_entries（user_id ごと）
       ├─ amount     … その時点のルールで確定した金額
       └─ breakdown  … 内訳（勝利/HR/投手/その他）のスナップショット
```

`games` は `(game_date, opponent)` で一意。同じ試合を2人が登録しても1行に寄り、
それぞれの `saving_entries` に自分のルールでの金額が入る。

### 2.2 過去の金額は再計算しない

`saving_entries.amount` と `breakdown` は登録時点のスナップショットとして保存する。
貯金ルールを後から変更しても、確定済みの過去の貯金額は変わらない。

### 2.3 ホームランの数え方

`games.home_runs` は**満塁ホームランを含まない**本数。旧 baseball-savings アプリの
数え方（HRと満塁HRを別カウント）を踏襲しており、過去データをそのまま移行できる。

### 2.4 投手ボーナス

- 先発ハイライト（QS / 完投 / 完封 / ノーヒットノーラン / 完全試合）は**最上位のみ**加算
- セーブは先発ハイライトと独立して加算

### 2.5 月末ワンバンク入金（仕様書9章）

```
calculating   月内集計中
    ↓ 「この月の金額を確定する」
ready         月末金額確定（金額コピー / ワンバンク起動）
    ↓ 「入金手続き中にする」
deposit_pending  入金待ち
    ↓ 「入金済みにする」
deposited     入金済み
```

Marine Wallet から送金は行わない。金額をクリップボードへコピーし、外部アプリを起動するだけ。

---

## 3. 実装状況

### Phase 1 統合基盤 — 実装済み

- [x] Marine Wallet UI（デザイントークン / 5タブナビ / 絵文字なしのアイコン体系）
- [x] 共通ログイン（Supabase Auth・SSR セッション・未ログインリダイレクト）
- [x] ロッテ貯金（試合記録・貯金ルール設定・月間集計）
- [x] 割り勘（均等 / 比率 / 金額、2〜3人、精算、メンバー管理）
- [x] 共通履歴（累計推移・月次サマリー・カテゴリ別支出・統合タイムライン）
- [x] 共通DB（マイグレーションSQL / RLS / 旧データ移行手順）

### Phase 2 ロッテ貯金自動化 — 一部実装

- [x] 貯金ルール（毎試合の入力項目を減らす前提の設定画面）
- [x] カスタム貯金（試合に紐づかない任意額の積立）
- [x] 月間集計・月末確定・月間目標
- [ ] NPB試合データ取得（Cron / Serverless）
- [ ] 試合イベント解析による自動判定
- [ ] LIVE表示

`games.source` に `'manual' | 'npb'` を用意済み。自動取得を追加する際は、
`games` へ upsert するワーカーを足すだけで `saving_entries` 側の計算ロジック
（`lib/savings.ts` の `calcSaving`）はそのまま再利用できる。

### Phase 3 外部アプリ連携 — 一部実装

- [x] 金額コピー（ワンバンク / PayPay）
- [x] 入金ステータス・精算ステータス
- [x] 外部アプリ起動（起動URLはマイページで設定）
- [ ] CSV Import（OneBank / MoneyForward）

起動URL（アプリのURLスキーム）は端末とアプリのバージョンで変わるため、
コードに埋め込まずマイページから設定する方式にした。未設定でも金額コピーは使える。

### Phase 4 Marine Link — 未着手

- [x] Marine ID の採番（`profiles.marine_id` / `MW-XXXXXX`）
- [ ] Link Request / 承認
- [ ] `marine_links` / `link_permissions`
- [ ] 権限に応じた RLS 拡張
- [ ] 月間比較・共同貯金

`games` を共有テーブルにしてあるため、Marine Link を追加しても試合データの重複は発生しない。

### Phase 5 Marine Day — 未着手

`marine_days` / `beer_logs` / `attendance_logs` / `seat_logs` / `collections` / `trips`。
`records.game_id` と `records.category` を先行して用意してあり、観戦支出を試合に紐づける準備は済んでいる。

### Phase 6 Insight — 一部実装

- [x] 月次サマリー（貯金・試合数・勝率・支出・未精算）
- [x] 履歴の4タブ（貯金推移 / 取引履歴 / 月別 / 年別）、前月比、継続日数
- [ ] Season Report / Fan Score / Memory Card
- [ ] 通知（マイページに枠だけ用意）

---

## 4. 移行手順

1. ~~Supabase 共通プロジェクト（`xliszlnpypvqghrwplxa`）で `0001_marine_wallet_core.sql` / `0003_confirmed_ui.sql` を実行する~~
   **適用済み**。既存の `records`（92件）と `settings` は変更していない。
   **プロジェクト名の「割り勘メモ」→「Marine Wallet」への変更はダッシュボード操作のみ**（Management API に改称の口が無いため）。
   Supabase ダッシュボード → Project Settings → General → Project name。ref とキーは変わらないので、
   改称してもアプリの環境変数を直す必要はない。
2. Vercel の環境変数を `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` に差し替える
3. 旧ロッテ貯金プロジェクト（`uwlnylkkcieqzvrrixjj` / PAUSED）を Restore し、`games` を CSV エクスポートする
   - **注意**: 組織は Free プランで、現在 `割り勘メモ`（= Marine Wallet 共通DB）と `relay` の2プロジェクトが稼働中。
     Free プランの稼働プロジェクト数上限に達しているため、Restore の前に `relay` を一時停止するか、
     プランを上げる必要がある。CSV を取得したら旧プロジェクトは再び Pause してよい
4. `0002_import_legacy_games.sql` の手順に従って取り込む
5. 取り込み結果を確認したら、旧プロジェクトを削除または PAUSED に戻す

### 適用時に判明した制約

- `saving_entries.month` は当初 `to_char(entry_date, 'YYYY-MM')` の生成列にしていたが、
  `to_char` は immutable ではないため生成列に使えない。`extract` + `lpad` で組み立てる形に変更した。
- Supabase の security linter（0011）に合わせ、`touch_updated_at` と `generate_marine_id` は
  `search_path = ''` を固定している。既存の `update_updated_at`（割り勘アプリ由来）は未対応のまま残っている。

---

## 5. 未確定事項

- **ワンバンク / PayPay の起動URL**: 端末依存のためマイページ設定に逃がした。
  実機で確認できたURLがあれば既定値としてコードに持たせてもよい。
- **NPB試合データの取得元**: 仕様書8章は「取得可能な試合情報を利用」とあるが、
  実際の取得元・利用条件は未確定。完全個人利用の範囲を超えないよう、実装前に取得先の
  利用規約を確認する必要がある。
- **観戦（現地）フラグ**: 仕様書21章の Attendance Log は Phase 5。現状ホームの
  「今月の試合」は記録した試合数であり、現地観戦数ではない。

---

## 6. 旧「割り勘メモ」からの置き換え状況

| 対象 | 状況 |
| --- | --- |
| 割り勘の計算ロジック | `lib/warikan.ts` として原本と同一のまま移設済み |
| `records` / `settings` テーブル | `records` は継続利用（92件保持）。`settings` はメンバー移行元として読み取り済みで、アプリからは参照しなくなった（削除はしていない） |
| メンバー管理 | `settings.member_a/b/c` の2〜3人固定から `split_members` の人数無制限へ置き換え |
| Supabase プロジェクト名 | 「割り勘メモ」のまま。改称はダッシュボード操作が必要 |
| 旧デプロイ（warikan-app-puce.vercel.app） | 本アプリが上位互換。停止・削除は利用者側の判断 |

`settings` テーブルは移行元として残してあるだけで、アプリのコードからは参照していない。
移行結果に問題がないことを確認できたら削除してよい。
