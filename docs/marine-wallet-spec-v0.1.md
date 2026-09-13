# Marine Wallet 統合仕様書
**Version:** 0.1  
**作成日:** 2026-09-13  
**用途:** 完全個人利用 / 非商用  
**対象:** iPhone / Android / Web App

---

## 1. プロジェクト概要

### 1.1 サービス名
**Marine Wallet**

### 1.2 コンセプト
千葉ロッテマリーンズの観戦体験を軸に、以下を1つのアプリへ統合する。

- ロッテ貯金
- 割り勘
- 観戦記録
- 試合結果連動
- 観戦支出管理
- ビール杯数などのライフログ
- アカウント間データ共有
- 月末のワンバンク入金管理
- PayPay等を利用した割り勘精算補助
- 年間・月間の分析 / レポート

単なる金融管理アプリではなく、  
**「マリーンズファンの観戦人生とお金を記録するアプリ」**  
を目指す。

---

## 2. 統合対象の既存Webアプリ

### 2.1 ロッテ貯金
https://baseball-savings.vercel.app/

主な既存機能:

- ログイン
- 対戦相手選択
- 試合フェーズ選択
- 試合結果選択
- 打撃ボーナス
- 投手ボーナス
- 貯金額算出
- 貯金履歴
- 累計グラフ

### 2.2 割り勘アプリ
https://warikan-app-puce.vercel.app/

主な既存機能:

- ログイン
- 割り勘作成
- 支出登録
- 参加者管理
- 精算金額算出
- 未精算 / 精算済み管理

---

# 3. 統合後の基本構造

Marine Walletを親アプリとし、既存2サービスを機能として統合する。

```text
Marine Wallet
│
├─ ホーム
│
├─ 貯金
│   ├─ ロッテ貯金
│   ├─ 月間集計
│   ├─ 貯金ルール
│   ├─ 共同貯金
│   └─ 月末入金
│
├─ 割り勘
│   ├─ 割り勘作成
│   ├─ 支出登録
│   ├─ メンバー管理
│   ├─ 精算
│   └─ 履歴
│
├─ Game / Marine Day
│   ├─ 試合結果
│   ├─ 観戦記録
│   ├─ 支出
│   ├─ Beer Log
│   ├─ 座席
│   └─ 写真 / メモ
│
├─ Marine Link
│   ├─ Marine ID
│   ├─ アカウント共有
│   ├─ 権限設定
│   └─ 共同目標
│
├─ 履歴 / Insight
│   ├─ 貯金推移
│   ├─ 支出
│   ├─ 観戦成績
│   ├─ Season Report
│   └─ Fan Score
│
└─ マイページ
    ├─ アカウント
    ├─ 通知
    ├─ 共有設定
    ├─ データ連携
    └─ セキュリティ
```

---

# 4. UI / UX 方針

## 4.1 トンマナ

既存2サービスのUIは全面的に統一する。

### デザインテーマ
**Near Future × Fintech × Baseball × Marine**

### 基本カラー
- Black
- Graphite
- White
- Silver
- Cyan / Teal Accent

### UI表現
- ダークモード主体
- Glassmorphism
- 高コントラスト
- 細いボーダー
- 微細な発光
- 金属感 / ガラス感
- 余白を広く取る
- 金融アプリらしい整理された情報設計

### 禁止事項
**絵文字をUIに使用しない。**

禁止例:

```text
⚾
🏆
🍺
🎉
😢
🤝
💥
⚡
```

代替:

- モノクロのLine Icon
- SVG Icon
- Lucide Icons等
- テキスト
- 数値
- UIコンポーネント

サービス全体を「カジュアルなファンアプリ」ではなく、  
**高級感のある近未来型Fintechサービス**として見せる。

---

# 5. 共通ナビゲーション

モバイル版は5タブを基本とする。

```text
ホーム
貯金
割り勘
履歴
マイページ
```

Game / Marine Day / Marine Linkなどは各画面から遷移させる。

---

# 6. ホーム画面

表示例:

```text
MARINE WALLET

累計ロッテ貯金
¥128,400

今月の積立予定額
¥12,500

未精算
¥4,820

今月の観戦
7 Games
```

### 主要CTA

通常時:

```text
今月の積立状況を見る
割り勘を作成
```

月末:

```text
ワンバンクで今月分を貯金する
```

### 最近のアクティビティ
- 試合結果
- 貯金確定
- 割り勘
- 精算
- Beer Log
- 観戦支出
- Marine Link

---

# 7. ロッテ貯金

## 7.1 基本方針

将来的にユーザーが毎試合入力する方式を廃止する。

ユーザーが設定するのは  
**「貯金ルール」だけ** とする。

試合結果・HR・投手成績等は取得データから自動判定する。

## 7.2 貯金ルール例

```text
勝利                 ¥500
引き分け             ¥200
サヨナラ勝利       +¥500

ホームラン           ¥200 / 本
満塁ホームラン       ¥500 / 本

完封                 ¥500
QS                   ¥200
セーブ               ¥100

CS                   ×1.2
日本シリーズ         ×1.5
```

ユーザーごとに個別設定可能。

---

# 8. NPB試合データ連携

## 8.1 方針

完全個人利用のため、NPB公式等から取得可能な試合情報を利用し、Marine Wallet内部で貯金条件へ変換する。

Marine Walletは試合速報サービスではなく、

**試合データ → 貯金金額**

へ変換するアプリとして設計する。

## 8.2 自動取得・判定対象

### 試合基本情報
- 日付
- 対戦相手
- ホーム / ビジター
- 球場
- 試合開始時間
- 現在のイニング
- 現在スコア
- 最終スコア

### 試合結果
- 勝利
- 敗北
- 引き分け
- サヨナラ勝利

### 打撃
- 安打
- 本塁打
- 満塁本塁打
- 打点
- 盗塁
- 三振
- 四死球

### 投手
- 勝利投手
- 敗戦投手
- セーブ
- 投球回
- 自責点
- 完封
- QS等

## 8.3 自動化イメージ

```text
NPB試合データ
        ↓
Marine Wallet
        ↓
試合イベント解析
        ↓
ユーザーの貯金ルール適用
        ↓
試合ごとの積立予定額
        ↓
月間積立予定額へ加算
```

## 8.4 LIVE表示

試合中:

```text
LIVE

MARINES 3
LIONS   2

7回裏

現在の積立予定額
¥900

勝利予定
¥500

HR ×2
¥400
```

試合終了後に最終確定する。

---

# 9. 月末ワンバンク入金

## 9.1 基本仕様

ワンバンクへの実際の入金は  
**毎試合ではなく月末に1回だけ実施する。**

## 9.2 フロー

```text
試合終了
↓
貯金金額自動計算
↓
Marine Wallet内に積立予定額として記録
↓
月内の各試合分を加算
↓
月末
↓
月間確定額
↓
ワンバンクを起動
↓
ユーザー本人が入金
↓
Marine Walletで入金済みに変更
```

## 9.3 状態管理

```text
CALCULATING
月内集計中

READY
月末金額確定

DEPOSIT_PENDING
ワンバンク入金待ち

DEPOSITED
入金済み
```

## 9.4 月末画面

```text
SEPTEMBER SAVINGS

確定額
¥12,400

対象試合
18 Games

勝利ボーナス
¥5,500

HRボーナス
¥3,400

投手ボーナス
¥2,000

その他
¥1,500

ワンバンクで¥12,400を貯金する
```

## 9.5 ワンバンク連携

Marine Walletから直接送金するのではなく、

```text
金額コピー
↓
ワンバンク起動
↓
本人が入金
```

とする。

Marine Wallet自体は資金を保有・移動しない。

---

# 10. 割り勘

## 10.1 基本機能

- 割り勘作成
- メンバー追加
- 支出登録
- 支払者登録
- 均等割り
- 個別金額指定
- 未精算
- 精算済み
- 精算履歴

## 10.2 例

```text
A 支払済
¥16,800

B 支払済
¥5,400

TOTAL
¥22,200

1人あたり
¥11,100

精算
B → A
¥5,700
```

---

# 11. PayPay等の金融アプリ連携

## 11.1 PayPay

個人間送金をMarine Walletから直接実行するのではなく、

```text
B → A
精算額
¥3,500

金額をコピー
PayPayを開く
```

とする。

PayPayで本人が送金後、

```text
精算済みにする
```

を押す。

## 11.2 金融連携の基本思想

Marine Walletは金融機関にならず、

**各金融アプリを束ねるコントロールセンター**

として機能する。

```text
Marine Wallet
│
├─ NPB
│   └─ 試合データ
│
├─ OneBank
│   └─ 月末貯金
│
├─ PayPay
│   └─ 割り勘精算
│
└─ CSV Import
    └─ 金融履歴
```

---

# 12. CSV Import

将来的に以下を取り込める設計とする。

- OneBank CSV
- MoneyForward CSV
- その他銀行 / カードCSV

### 利用例

```text
ZOZOマリン関連支出

チケット
¥7,600

飲食
¥4,800

交通
¥2,140

グッズ
¥5,500

TOTAL
¥20,040
```

---

# 13. Marine Link

## 13.1 概要

アカウントAとアカウントBがMarine Wallet内部でデータを共有できる。

メールアドレスではなく  
**Marine ID** を利用する。

例:

```text
Account A
MW-7K4F2A

Account B
MW-9P8X3C
```

## 13.2 接続フロー

```text
Marine ID入力
↓
共有リクエスト
↓
相手が承認
↓
CONNECTED
```

QRコードによる追加にも対応可能。

---

# 14. Marine Link 共有対象

- 試合情報
- 試合結果
- ロッテ貯金
- 貯金ルール
- 月末入金状況
- 割り勘
- 観戦情報
- Marine Day
- Beer Log
- 共同目標

## 14.1 権限設定

共有データは個別ON/OFF可能。

```text
試合情報
ON

ロッテ貯金額
ON

貯金ルール
OFF

月末入金状況
OFF

割り勘
ON

観戦情報
ON

Beer Log
OFF
```

---

# 15. 試合データ共有方式

試合結果はユーザーごとにコピーしない。

共通Gameデータを利用する。

```text
GAME
2026-09-13

Marines
5

Lions
3

Result
WIN

HR
2
```

そこへユーザー別ルールを適用する。

```text
GAME
│
├─ Account A
│   ├─ Win ¥500
│   ├─ HR ¥400
│   └─ Total ¥900
│
└─ Account B
    ├─ Win ¥1,000
    ├─ HR ¥200
    └─ Total ¥1,200
```

原則:

**試合結果は共有。  
貯金ルールは個人。**

---

# 16. Marine Link 月間比較

```text
SEPTEMBER

YOU
¥8,700

ACCOUNT B
¥11,200

COMBINED
¥19,900
```

COMBINEDは表示上の合計のみ。

実際の資金は、

```text
A → A自身のOneBank
B → B自身のOneBank
```

とする。

---

# 17. 共同貯金

独立サービスではなく、  
**ロッテ貯金内の機能**として扱う。

例:

```text
2027 OPENING GAME TRIP

目標
¥100,000

Account A
¥28,500

Account B
¥31,200

TOTAL
¥59,700

59.7%
```

Marine Walletでは記録上の共同目標を管理する。

---

# 18. Marine Day

## 18.1 概要

1試合を単位として、

- 試合
- 観戦
- 金融
- 割り勘
- ライフログ

を統合する中心機能。

## 18.2 Marine Day例

```text
MARINE DAY

2026.10.04
vs SoftBank

FINAL
MARINES 5 - 3 HAWKS

Seat
内野指定席A

TICKET
¥7,600

TRANSPORT
¥1,240

FOOD
¥1,350

BEER
3杯
¥2,400

GOODS
¥2,000

TOTAL
¥14,590

SPLIT
¥4,200

LOTTE SAVINGS
¥1,500

NET COST
¥8,890
```

---

# 19. Beer Log

## 19.1 基本仕様

観戦中のビール杯数を記録する。

単純な飲酒量競争ではなく、

**観戦支出 / ライフログ**

として扱う。

## 19.2 記録項目

- 杯数
- 時刻
- 商品名
- 金額
- 店舗 / 売り子
- Marine Day
- メモ

例:

```text
BEER LOG

1杯目
17:42
¥800

2杯目
18:26
¥800

3杯目
19:35
¥800

TOTAL
3杯
¥2,400
```

## 19.3 集計

```text
2026 SEASON

観戦
14 Games

Beer
31杯

Total
¥24,800

Average / Game
2.2杯

Average Cost / Game
¥1,771
```

飲酒量を増やす称号・ランキング等のゲーミフィケーションは行わない。

---

# 20. Game Log

記録対象:

- 日付
- 対戦相手
- 球場
- ホーム / ビジター
- 座席
- 試合結果
- スコア
- 観戦有無
- 写真
- メモ
- Marine Day

---

# 21. Attendance Log

自動集計:

```text
2026

現地観戦
18 Games

12 Wins
6 Losses

Win Rate
66.7%
```

---

# 22. My Seat

過去の観戦座席を記録する。

将来的に以下を分析可能。

- 席種別観戦数
- 席種別勝率
- 席種別平均支出
- よく利用するエリア
- 価格帯

---

# 23. Stadium Wallet

球場関連支出のみを集計する。

対象:

- チケット
- 交通
- 飲食
- ビール
- グッズ
- その他

例:

```text
TODAY AT ZOZO MARINE

Ticket
¥7,600

Food
¥2,150

Beer
¥2,400

Goods
¥5,000

TOTAL
¥17,150
```

---

# 24. Budget Mode

観戦日の予算を設定する。

```text
TODAY'S BUDGET

Budget
¥15,000

Used
¥9,420

Remaining
¥5,580
```

---

# 25. Round-up Save

観戦支出の端数を貯金候補として表示。

例:

```text
今日の支出
¥3,720

¥4,000までの差額
¥280

積立候補
¥280
```

自動送金はしない。

---

# 26. Collection

グッズ / チケット / 限定品などの購入履歴を管理。

項目:

- 商品名
- カテゴリ
- 金額
- 購入日
- 購入場所
- 写真
- Marine Day

---

# 27. Trip Mode

遠征を1イベントとして管理。

```text
TRIP
FUKUOKA

Flight
¥24,000

Hotel
¥12,000

Ticket
¥6,500

Food
¥5,400

Transport
¥3,200

TOTAL
¥51,100
```

Marine Linkと組み合わせ、複数人の割り勘にも対応。

---

# 28. Fan Score

ユーザーの活動を総合的に可視化する。

対象例:

- 観戦試合数
- ロッテ貯金
- 観戦記録
- Marine Day登録
- Season継続利用

金額や飲酒量そのものを競わせる設計にはしない。

---

# 29. Season Report

Spotify Wrappedのような年間まとめを自動生成する。

例:

```text
YOUR MARINES 2026

現地観戦
18 Games

Record
12-6

Win Rate
66.7%

Average Game Cost
¥9,840

Annual Game Cost
¥177,120

Lotte Savings
¥48,500

Most Watched Opponent
SoftBank

Best Seat Win Rate
内野指定席A

Average Beer
1.8 cups
```

SNS共有用カード生成を将来的に実装可能。

---

# 30. Memory Card

各試合を1枚のデジタルカードとして保存する。

含める情報:

- 日付
- 対戦相手
- スコア
- 勝敗
- 球場
- 座席
- 支出
- 貯金
- Beer Log
- 写真
- メモ

---

# 31. データモデル案

```text
users

profiles

wallets

transactions

games

game_events

saving_rules

saving_records

monthly_savings

marine_days

marine_day_members

expenses

expense_members

split_groups

split_expenses

settlements

beer_logs

attendance_logs

seat_logs

collections

trips

marine_links

link_permissions

shared_goals

shared_goal_members
```

---

# 32. transactions 設計案

共通取引台帳として利用する。

```text
LOTTE_SAVING
MANUAL_SAVING
SHARED_SAVING
SPLIT_PAYMENT
SPLIT_RECEIVE
SETTLEMENT
ADJUSTMENT
GAME_COST
BEER_COST
GOODS_COST
TRANSPORT_COST
```

---

# 33. Marine Link DB例

```text
marine_links
  id
  user_a
  user_b
  status
  created_at

link_permissions
  marine_link_id
  resource_type
  permission
```

3人以上のグループへ将来的に拡張可能な構造にする。

---

# 34. アカウント / 認証

既存割り勘アプリ側のユーザー認証をベースとして、Marine Wallet全体の共通認証へ統合する。

候補:

- Supabase Auth
- Firebase Auth
- 独自認証

推奨:
**Supabase**

理由:

- Auth
- PostgreSQL
- Realtime
- Row Level Security
- Storage

を1つにまとめやすい。

---

# 35. 権限

Marine LinkではRow Level Security等を利用し、

- 自分のデータ
- 共有許可されたデータ
- 共通Gameデータ

を明確に分ける。

相手ユーザーが閲覧できるのは、本人が許可したデータのみとする。

---

# 36. 通知

候補:

### Game
- 試合開始
- 試合終了
- 貯金額確定

### Saving
- 月末貯金確定
- OneBank入金待ち

### Split
- 割り勘追加
- 精算依頼
- 精算完了

### Marine Link
- Link Request
- Link Accepted

---

# 37. 月次レポート

例:

```text
SEPTEMBER REPORT

LOTTE SAVINGS
¥12,400

GAME
18 Games

WINS
11

HOME RUN
17

GAME COST
¥38,450

BEER
11 cups
¥8,800

UNSETTLED
¥3,200
```

---

# 38. Marine Walletの役割

Marine Wallet自身は、

- 銀行
- 決済サービス
- 電子マネー

にはならない。

役割は、

```text
Collect
記録

Calculate
計算

Analyze
分析

Share
共有

Guide
外部金融アプリへ誘導
```

とする。

---

# 39. 推奨システム構成

```text
Frontend
Next.js / React
Vercel

Backend
Supabase

Database
PostgreSQL

Auth
Supabase Auth

Realtime
Supabase Realtime

Storage
Supabase Storage

Baseball Data Worker
Serverless Function / Cron

External
NPB Data
OneBank
PayPay
```

---

# 40. 優先実装順位

## Phase 1
統合基盤

- Marine Wallet UI
- 共通ログイン
- ロッテ貯金
- 割り勘
- 共通履歴
- 共通DB

## Phase 2
ロッテ貯金自動化

- 試合データ取得
- Game DB
- 自動貯金計算
- 月間集計
- 月末確定

## Phase 3
外部アプリ連携

- OneBank起動
- 金額コピー
- 入金ステータス
- PayPay起動
- 割り勘金額コピー
- 精算ステータス

## Phase 4
Marine Link

- Marine ID
- Link Request
- 権限管理
- データ共有

## Phase 5
Marine Day

- Game Log
- Stadium Wallet
- Beer Log
- Seat Log
- Collection

## Phase 6
Insight

- 月次Report
- Season Report
- Fan Score
- Memory Card

---

# 41. 最終コンセプト

Marine Walletは、

**「ロッテ貯金アプリ」**
でもなく、

**「割り勘アプリ」**
でもない。

最終的には、

> マリーンズ観戦に関わる  
> 試合・お金・仲間・体験を  
> 1つのタイムラインへ統合する。

サービスとする。

---

## Product Keywords

```text
SAVE
SPLIT
GAME
LINK
LOG
INSIGHT
```

---

## Brand Statement

**Marine Wallet**

マリーンズを応援する毎日を、  
記録し、つなぎ、未来へ積み立てる。

---

## 現時点の重要仕様まとめ

1. 既存のロッテ貯金＋割り勘Webアプリを統合する。
2. UIは近未来型Fintechデザインへ全面刷新する。
3. UIに絵文字は使用しない。
4. ロッテ貯金は試合データから自動計算する。
5. 実際のOneBank入金は月末のみ行う。
6. Marine Wallet自身は資金を扱わない。
7. PayPay等は外部アプリ起動＋金額コピーを基本とする。
8. Marine IDでアカウント同士をLinkできる。
9. 試合・貯金・割り勘・観戦情報を共有できる。
10. 共有範囲は個別に権限設定する。
11. 共同貯金はロッテ貯金内の機能とする。
12. Marine Dayを試合単位の中心データ構造とする。
13. Beer Logなど観戦ライフログを追加する。
14. Season Reportで年間体験を可視化する。
15. 完全個人利用 / 非商用アプリとして開発する。
