-- ============================================================================
-- Marine Wallet / 0022_custom_presets
-- ----------------------------------------------------------------------------
-- カスタム登録の「定型」を、貯金ルールから増やせるようにする。
--
-- これまではサヨナラ勝利・ノーヒットノーラン・完全試合の3つを
-- アプリ側に直書きし、金額を saving_rule_settings の列から引いていた。
-- NPB から取得できない記録は人によって増えるので、行として持たせて
-- 貯金ルールの画面から追加・削除できるようにする。
--
-- 読み取りはログイン中の全員。追加・変更・削除ができるのは
-- 貯金ルールを変更できる人だけ（can_edit_saving_rules）。
--
-- saving_rule_settings の sayonara_bonus / no_hitter_amount /
-- perfect_game_amount は残す。過去に自動登録で記録した試合を編集したときに
-- calcSaving が参照するため、消すと過去の金額が変わってしまう。
-- 画面からは触れなくなるので、値はこの時点で固定される。
--
-- 冪等性: 何度実行しても安全。
-- ============================================================================

create table if not exists public.saving_custom_presets (
  id uuid primary key default gen_random_uuid(),

  label text not null,
  amount int not null default 0 check (amount >= 0),

  -- 並び順。小さいほど先に出す
  sort_order int not null default 0,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null,

  -- 同じ名前の定型を2つ作らせない
  constraint saving_custom_presets_label_unique unique (label),
  constraint saving_custom_presets_label_not_blank check (btrim(label) <> '')
);

create index if not exists saving_custom_presets_sort_idx
  on public.saving_custom_presets (sort_order, label);

alter table public.saving_custom_presets enable row level security;

-- 読み取りは全員。カスタム登録の画面で選択肢を出すのに必要
drop policy if exists "saving_custom_presets_select_all" on public.saving_custom_presets;
create policy "saving_custom_presets_select_all" on public.saving_custom_presets
  for select to authenticated using (true);

-- 追加・変更・削除は貯金ルールを変更できる人だけ
drop policy if exists "saving_custom_presets_insert_allowed" on public.saving_custom_presets;
create policy "saving_custom_presets_insert_allowed" on public.saving_custom_presets
  for insert to authenticated
  with check (public.can_edit_saving_rules());

drop policy if exists "saving_custom_presets_update_allowed" on public.saving_custom_presets;
create policy "saving_custom_presets_update_allowed" on public.saving_custom_presets
  for update to authenticated
  using (public.can_edit_saving_rules())
  with check (public.can_edit_saving_rules());

drop policy if exists "saving_custom_presets_delete_allowed" on public.saving_custom_presets;
create policy "saving_custom_presets_delete_allowed" on public.saving_custom_presets
  for delete to authenticated
  using (public.can_edit_saving_rules());

drop trigger if exists saving_custom_presets_touch_updated_at on public.saving_custom_presets;
create trigger saving_custom_presets_touch_updated_at
  before update on public.saving_custom_presets
  for each row execute function public.touch_updated_at();

-- ----------------------------------------------------------------------------
-- 初期データ
-- ----------------------------------------------------------------------------
-- これまで直書きしていた3つを、現在のルールの金額のまま移す。
-- 既に行がある場合は触らない（再実行しても金額を巻き戻さない）。
insert into public.saving_custom_presets (label, amount, sort_order)
select v.label, v.amount, v.sort_order
from (
  select 'サヨナラ勝利' as label,
         coalesce((select r.sayonara_bonus from public.saving_rule_settings r), 500) as amount,
         10 as sort_order
  union all
  select 'ノーヒットノーラン',
         coalesce((select r.no_hitter_amount from public.saving_rule_settings r), 3000),
         20
  union all
  select '完全試合',
         coalesce((select r.perfect_game_amount from public.saving_rule_settings r), 5000),
         30
) v
on conflict (label) do nothing;
