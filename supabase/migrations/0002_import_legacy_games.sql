-- ============================================================================
-- Marine Wallet / 0002_import_legacy_games（任意・データ移行用）
-- ----------------------------------------------------------------------------
-- 旧「千葉ロッテマリーンズ貯金」プロジェクト（ref: uwlnylkkcieqzvrrixjj）の
-- games テーブルを、Marine Wallet の games + saving_entries へ移行する。
--
-- 手順:
--   1. 旧プロジェクトは現在 PAUSED のため、Supabase ダッシュボードで Restore する。
--   2. 旧プロジェクトの SQL Editor で以下を実行し、結果を CSV でダウンロードする。
--        select date, phase, opponent, result, home_runs, grand_slams,
--               pitcher_bonus, amount, other_bonus_amount, other_bonus_note
--        from games order by date;
--   3. Marine Wallet 側で本ファイルの STEP 1 を実行して受け皿テーブルを作る。
--   4. Table Editor で legacy_games に CSV をインポートする。
--   5. STEP 2 の :target_user_id を自分の auth.users.id に置き換えて実行する。
--   6. 取り込み結果を確認したら STEP 3 で受け皿テーブルを削除する。
--
-- 金額は再計算せず、旧アプリで確定した amount をそのまま保持する
-- （過去の貯金額が現在の貯金ルール変更で書き換わらないようにするため）。
-- ============================================================================

-- ---------------------------------------------------------------- STEP 1 ---
create table if not exists public.legacy_games (
  date date,
  phase text,
  opponent text,
  result text,
  home_runs int,
  grand_slams int,
  pitcher_bonus text,
  amount int,
  other_bonus_amount int,
  other_bonus_note text
);

-- ---------------------------------------------------------------- STEP 2 ---
-- 実行前に ':target_user_id' を自分のユーザーID（uuid）に置換すること。
--
-- with legacy as (
--   -- 同一日・同一対戦相手の重複行は1件に寄せる（games の一意制約に合わせる）
--   select distinct on (l.date, l.opponent)
--     l.date as game_date,
--     l.opponent,
--     case l.phase when 'japan' then 'nippon_series' else coalesce(l.phase, 'regular') end as phase,
--     case when l.result in ('win', 'sayonara') then 'win'
--          when l.result = 'draw' then 'draw'
--          else 'lose' end as result,
--     (l.result = 'sayonara') as is_sayonara,
--     coalesce(l.home_runs, 0) as home_runs,
--     coalesce(l.grand_slams, 0) as grand_slams,
--     case l.pitcher_bonus
--       when 'perfect' then 'perfect_game'
--       when 'nohit' then 'no_hitter'
--       when 'shutout' then 'shutout'
--       when 'complete' then 'complete_game'
--       else 'none' end as pitching_highlight,
--     (l.pitcher_bonus = 'save') as has_save,
--     coalesce(l.amount, 0) as amount,
--     coalesce(l.other_bonus_amount, 0) as other_amount,
--     coalesce(l.other_bonus_note, '') as other_note
--   from public.legacy_games l
--   where l.date is not null
--   order by l.date, l.opponent
-- ),
-- upserted_games as (
--   insert into public.games (
--     game_date, opponent, phase, result, is_sayonara,
--     home_runs, grand_slams, pitching_highlight, has_save, source, created_by
--   )
--   select game_date, opponent, phase, result, is_sayonara,
--          home_runs, grand_slams, pitching_highlight, has_save, 'manual', ':target_user_id'::uuid
--   from legacy
--   on conflict (game_date, opponent) do update
--     set result = excluded.result,
--         is_sayonara = excluded.is_sayonara,
--         home_runs = excluded.home_runs,
--         grand_slams = excluded.grand_slams,
--         pitching_highlight = excluded.pitching_highlight,
--         has_save = excluded.has_save
--   returning id, game_date, opponent
-- )
-- insert into public.saving_entries (user_id, game_id, entry_date, amount, breakdown, other_amount, other_note)
-- select ':target_user_id'::uuid, g.id, l.game_date, l.amount, '[]'::jsonb, l.other_amount, l.other_note
-- from legacy l
-- join upserted_games g on g.game_date = l.game_date and g.opponent = l.opponent
-- on conflict (user_id, game_id) do update
--   set amount = excluded.amount,
--       other_amount = excluded.other_amount,
--       other_note = excluded.other_note,
--       entry_date = excluded.entry_date;

-- ---------------------------------------------------------------- STEP 3 ---
-- drop table if exists public.legacy_games;
