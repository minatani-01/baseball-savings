-- ============================================================================
-- Marine Wallet / 0020_drop_annual_goal
-- ----------------------------------------------------------------------------
-- 年間の目標金額をやめる。
--
-- ホームのタイル・貯金ルールの入力欄・貯金タブの進捗バーをすべて外したので、
-- 設定する手段も表示する場所も無くなった。列だけ残すと
-- 「値は入っているのにどこにも出ない」状態になり、あとから読む人を惑わせる。
--
-- 落とす時点の値は 60000（2026年の目標として設定されていたもの）。
-- 戻すときは saving_rule_settings に列を足し直せばよい。
-- ============================================================================
alter table public.saving_rule_settings
  drop column if exists annual_goal_amount;

alter table public.saving_rule_settings
  drop constraint if exists saving_rule_settings_amounts_check;

alter table public.saving_rule_settings
  add constraint saving_rule_settings_amounts_check check (
    win_amount >= 0 and draw_amount >= 0 and lose_amount >= 0 and sayonara_bonus >= 0
    and home_run_amount >= 0 and grand_slam_amount >= 0 and multi_hit_amount >= 0
    and rbi_amount >= 0 and perfect_game_amount >= 0 and no_hitter_amount >= 0
    and shutout_amount >= 0 and complete_game_amount >= 0 and quality_start_amount >= 0
    and winning_pitcher_amount >= 0 and save_amount >= 0
  );
