-- ============================================================================
-- Marine Wallet / 0025_push_subscriptions
-- ----------------------------------------------------------------------------
-- Web Push の購読先を持つ。
--
-- 1人が複数の端末を持つので、購読は端末ごとに1行。
-- endpoint がブラウザ側で一意なので、それを重複の判定に使う。
--
-- 自分の購読だけを読み書きできる。送信は service role で行うため、
-- Cron からは RLS を迂回して全員分を引ける。
--
-- iOS の注意:
--   Safari のタブでは購読できない。ホーム画面に追加した PWA からのみ
--   通知の許可を求められる（iOS 16.4 以降）。
--
-- 冪等性: 何度実行しても安全。
-- ============================================================================

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),

  user_id uuid not null references auth.users (id) on delete cascade,

  -- ブラウザが払い出す送信先。端末とブラウザの組み合わせごとに変わる
  endpoint text not null,

  -- 本文を暗号化するための鍵。購読時にブラウザから受け取る
  p256dh text not null,
  auth text not null,

  -- どの端末の購読か分かるようにしておく。整理するときの手がかり
  user_agent text not null default '',

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- 同じ端末から二重に登録させない
  constraint push_subscriptions_endpoint_unique unique (endpoint)
);

create index if not exists push_subscriptions_user_idx
  on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;

-- 自分の購読だけを扱える
drop policy if exists "push_subscriptions_select_own" on public.push_subscriptions;
create policy "push_subscriptions_select_own" on public.push_subscriptions
  for select to authenticated using (user_id = (select auth.uid()));

drop policy if exists "push_subscriptions_insert_own" on public.push_subscriptions;
create policy "push_subscriptions_insert_own" on public.push_subscriptions
  for insert to authenticated with check (user_id = (select auth.uid()));

drop policy if exists "push_subscriptions_update_own" on public.push_subscriptions;
create policy "push_subscriptions_update_own" on public.push_subscriptions
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists "push_subscriptions_delete_own" on public.push_subscriptions;
create policy "push_subscriptions_delete_own" on public.push_subscriptions
  for delete to authenticated using (user_id = (select auth.uid()));

drop trigger if exists push_subscriptions_touch_updated_at on public.push_subscriptions;
create trigger push_subscriptions_touch_updated_at
  before update on public.push_subscriptions
  for each row execute function public.touch_updated_at();
