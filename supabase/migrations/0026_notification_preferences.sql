-- ============================================================================
-- Marine Wallet / 0026_notification_preferences
-- ----------------------------------------------------------------------------
-- どの通知を受け取るかを、人ごとに持つ。
--
-- 端末ごとの設定は push_subscriptions（どの端末に届けるか）で、
-- ここは「何を届けるか」。端末を増やしても設定は引き継がれる。
--
-- 行が無いときは「全部受け取る」とみなす。既に登録している人が
-- この機能の追加で通知を取りこぼさないようにするため、既定は true にする。
--
-- 種類は画面の4つに合わせる。通知1つずつに分けると設定が多くなりすぎるので、
-- 利用者から見たまとまりで持つ。
--   games   … 試合の取り込み
--   savings … 月末の確定のリマインド、確定したあとの入金のお願い
--   split   … 割り勘の追加、精算のお願い
--   link    … 接続のリクエスト、接続の成立
--
-- 送信は service role で行うため、Cron からは RLS を迂回して全員分を引ける。
--
-- 冪等性: 何度実行しても安全。
-- ============================================================================

create table if not exists public.notification_preferences (
  user_id uuid primary key references auth.users (id) on delete cascade,

  games boolean not null default true,
  savings boolean not null default true,
  split boolean not null default true,
  link boolean not null default true,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.notification_preferences enable row level security;

-- 自分の設定だけを扱える
drop policy if exists "notification_preferences_select_own" on public.notification_preferences;
create policy "notification_preferences_select_own" on public.notification_preferences
  for select to authenticated using (user_id = (select auth.uid()));

drop policy if exists "notification_preferences_insert_own" on public.notification_preferences;
create policy "notification_preferences_insert_own" on public.notification_preferences
  for insert to authenticated with check (user_id = (select auth.uid()));

drop policy if exists "notification_preferences_update_own" on public.notification_preferences;
create policy "notification_preferences_update_own" on public.notification_preferences
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists "notification_preferences_delete_own" on public.notification_preferences;
create policy "notification_preferences_delete_own" on public.notification_preferences
  for delete to authenticated using (user_id = (select auth.uid()));

drop trigger if exists notification_preferences_touch_updated_at on public.notification_preferences;
create trigger notification_preferences_touch_updated_at
  before update on public.notification_preferences
  for each row execute function public.touch_updated_at();
