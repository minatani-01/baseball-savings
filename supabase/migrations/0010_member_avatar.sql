-- ============================================================================
-- Marine Wallet / 0010_member_avatar
-- ----------------------------------------------------------------------------
-- メンバーのアイコンを「名前の一文字目」から写真に変えられるようにする。
--
--   split_members.avatar_path  … Storage 上のオブジェクトパス
--   storage bucket member-avatars … 写真の実体
--
-- バケットは非公開にする。人物の写真は「URLを知っていれば誰でも見られる」状態に
-- したくないため、表示のたびにサーバー側で署名付きURLを発行する（lib/queries.ts）。
-- パスは <auth.uid()>/<member-id>-<timestamp>.jpg で、先頭フォルダが所有者と
-- 一致する場合だけ読み書きできる。
-- ============================================================================

alter table public.split_members
  add column if not exists avatar_path text;

comment on column public.split_members.avatar_path is
  'member-avatars バケット上のパス。null なら名前の頭文字を表示する';

-- ----------------------------------------------------------------------------
-- バケット
-- ----------------------------------------------------------------------------
-- public=false。file_size_limit はクライアント側で 256px の JPEG に変換してから
-- 上げるため十分な余裕がある値にしてある（変換を通さない経路への保険）。
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'member-avatars',
  'member-avatars',
  false,
  1048576,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

-- ----------------------------------------------------------------------------
-- RLS: 自分のフォルダだけ
-- ----------------------------------------------------------------------------
-- storage.objects は Supabase 側で RLS 有効。ここでは member-avatars ぶんだけ開ける。
drop policy if exists "member_avatars_select_own" on storage.objects;
drop policy if exists "member_avatars_insert_own" on storage.objects;
drop policy if exists "member_avatars_update_own" on storage.objects;
drop policy if exists "member_avatars_delete_own" on storage.objects;

create policy "member_avatars_select_own"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'member-avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "member_avatars_insert_own"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'member-avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "member_avatars_update_own"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'member-avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'member-avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "member_avatars_delete_own"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'member-avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
