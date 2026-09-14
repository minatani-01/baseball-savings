-- ============================================================================
-- Marine Wallet / 0012_annual_goal
-- ----------------------------------------------------------------------------
-- 目標金額を「月間」から「年間」に変える。
--
--   saving_rules.monthly_goal_amount  →  saving_rules.annual_goal_amount
--
-- 画面には「目標金額」としか出しておらず、月あたりなのか通算なのかが
-- 読み取れなかった。シーズンは3月から10月までで月ごとの試合数も揃わないため、
-- 月額より年額の方が目標として立てやすい。
--
-- 移行: 旧値は引き継がない（未設定＝0 から始める）。
-- 月額 × 12 は、シーズンが約6か月しかない以上ただの掛け算でしかなく、
-- 本人が選んでいない金額を目標として出すことになる。
-- 未設定なら画面は「未設定」と出て進捗バーも隠れるので、誤解が起きない。
-- ============================================================================

alter table public.saving_rules
  add column if not exists annual_goal_amount int not null default 0;

comment on column public.saving_rules.annual_goal_amount is
  '年間の目標貯金額。0 は未設定（進捗バーを表示しない）';

-- CHECK を先に張り替える。
-- 列を落とすと、その列を含む CHECK 制約ごと消えるため、
-- 同じ制約に入っている他の項目の >= 0 まで失われてしまう。
alter table public.saving_rules
  drop constraint if exists saving_rules_extra_amounts_check;

alter table public.saving_rules
  add constraint saving_rules_extra_amounts_check check (
    multi_hit_amount >= 0 and rbi_amount >= 0
    and winning_pitcher_amount >= 0 and annual_goal_amount >= 0
  );

alter table public.saving_rules
  drop column if exists monthly_goal_amount;
