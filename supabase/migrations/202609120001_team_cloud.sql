-- チーム境界はRLS、更新は権限検証つきRPCに限定する。
create table public.score_teams (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) between 1 and 60),
  created_at timestamptz not null default now()
);
create table public.score_memberships (
  team_id uuid not null references public.score_teams(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('admin','editor','viewer')),
  display_name text not null check (length(btrim(display_name)) between 1 and 60),
  primary key (team_id,user_id)
);
create index score_memberships_user on public.score_memberships(user_id,team_id);
create table public.score_books (
  team_id uuid primary key references public.score_teams(id) on delete cascade,
  revision bigint not null default 0,
  data jsonb,
  write_id uuid,
  updated_at timestamptz not null default now()
);
create table public.score_invites (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.score_teams(id) on delete cascade,
  email text not null,
  role text not null check (role in ('editor','viewer')),
  token_hash text not null unique,
  expires_at timestamptz not null default now() + interval '7 days',
  used_at timestamptz,
  revoked_at timestamptz
);
create index score_invites_team on public.score_invites(team_id);

alter table public.score_teams enable row level security;
alter table public.score_memberships enable row level security;
alter table public.score_books enable row level security;
alter table public.score_invites enable row level security;

create function public.score_role(p_team uuid) returns text language sql stable security definer set search_path = '' as $$
  select role from public.score_memberships where team_id=p_team and user_id=(select auth.uid());
$$;
revoke all on function public.score_role(uuid) from public, anon;
grant execute on function public.score_role(uuid) to authenticated;
create policy team_read on public.score_teams for select to authenticated using (public.score_role(id) is not null);
create policy membership_read on public.score_memberships for select to authenticated using (public.score_role(team_id) is not null);
create policy book_read on public.score_books for select to authenticated using (public.score_role(team_id) is not null);
create policy invite_read on public.score_invites for select to authenticated using (public.score_role(team_id)='admin');
revoke all on public.score_teams, public.score_memberships, public.score_books, public.score_invites from anon, authenticated;
grant select on public.score_teams, public.score_memberships, public.score_books to authenticated;
grant select (id,team_id,email,role,expires_at,used_at,revoked_at) on public.score_invites to authenticated;

create function public.score_create_team(p_name text,p_display_name text) returns uuid language plpgsql security definer set search_path='' as $$
declare v_team uuid;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  insert into public.score_teams(name) values(btrim(p_name)) returning id into v_team;
  insert into public.score_memberships values(v_team,auth.uid(),'admin',btrim(p_display_name));
  insert into public.score_books(team_id) values(v_team);
  return v_team;
end $$;

create function public.score_save_book(p_team uuid,p_revision bigint,p_data jsonb,p_write_id uuid) returns bigint language plpgsql security definer set search_path='' as $$
declare v_book public.score_books;
begin
  -- 権限変更と保存を同じチーム行のロックで直列化する。
  perform 1 from public.score_teams where id=p_team for update;
  if coalesce(public.score_role(p_team),'') not in ('admin','editor') then raise exception 'FORBIDDEN'; end if;
  if p_write_id is null or p_data is null or pg_column_size(p_data)>10485760 or
     p_data->>'version' is distinct from '2' or jsonb_typeof(p_data->'members') is distinct from 'array' or
     jsonb_typeof(p_data->'matches') is distinct from 'array' then raise exception 'INVALID_BOOK'; end if;
  if jsonb_array_length(p_data->'matches')=0 or not exists(select 1 from jsonb_array_elements(p_data->'matches') m where m->>'id'=p_data->>'activeId') then raise exception 'INVALID_BOOK'; end if;
  select * into v_book from public.score_books where team_id=p_team for update;
  if v_book.write_id=p_write_id and v_book.data=p_data then return v_book.revision; end if;
  if v_book.revision is distinct from p_revision then raise exception 'REVISION_CONFLICT'; end if;
  update public.score_books set data=p_data,revision=revision+1,write_id=p_write_id,updated_at=now() where team_id=p_team returning revision into p_revision;
  return p_revision;
end $$;

create function public.score_create_invite(p_team uuid,p_email text,p_role text) returns text language plpgsql security definer set search_path='' as $$
declare v_token text;
begin
  perform 1 from public.score_teams where id=p_team for update;
  if public.score_role(p_team) is distinct from 'admin' then raise exception 'FORBIDDEN'; end if;
  if p_role not in ('editor','viewer') or p_email is null or length(p_email)>254 or p_email not like '%_@_%._%' then raise exception 'INVALID_INVITE'; end if;
  v_token := replace(gen_random_uuid()::text || gen_random_uuid()::text,'-','');
  insert into public.score_invites(team_id,email,role,token_hash) values(p_team,lower(btrim(p_email)),p_role,encode(sha256(convert_to(v_token,'UTF8')),'hex'));
  return v_token;
end $$;

create function public.score_accept_invite(p_token text,p_display_name text) returns uuid language plpgsql security definer set search_path='' as $$
declare v_invite public.score_invites; v_email text; v_team uuid;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  select lower(email) into v_email from auth.users where id=auth.uid() and email_confirmed_at is not null;
  select team_id into v_team from public.score_invites where token_hash=encode(sha256(convert_to(p_token,'UTF8')),'hex');
  perform 1 from public.score_teams where id=v_team for update;
  select * into v_invite from public.score_invites where token_hash=encode(sha256(convert_to(p_token,'UTF8')),'hex') for update;
  if v_invite.id is null or v_invite.used_at is not null or v_invite.revoked_at is not null or v_invite.expires_at<=now() or v_email is distinct from v_invite.email then raise exception 'INVALID_INVITE'; end if;
  -- 既存メンバーの権限は招待コードで昇格・降格させない。
  insert into public.score_memberships(team_id,user_id,role,display_name) values(v_invite.team_id,auth.uid(),v_invite.role,btrim(p_display_name)) on conflict do nothing;
  update public.score_invites set used_at=now() where id=v_invite.id;
  return v_invite.team_id;
end $$;

create function public.score_revoke_invite(p_team uuid,p_id uuid) returns void language plpgsql security definer set search_path='' as $$
begin
  perform 1 from public.score_teams where id=p_team for update;
  if public.score_role(p_team) is distinct from 'admin' then raise exception 'FORBIDDEN'; end if;
  update public.score_invites set revoked_at=now() where id=p_id and team_id=p_team and used_at is null;
end $$;

create function public.score_set_role(p_team uuid,p_user uuid,p_role text) returns void language plpgsql security definer set search_path='' as $$
begin
  perform 1 from public.score_teams where id=p_team for update;
  if public.score_role(p_team) is distinct from 'admin' then raise exception 'FORBIDDEN'; end if;
  if p_role not in ('admin','editor','viewer','remove') or p_role is null then raise exception 'INVALID_ROLE'; end if;
  if exists(select 1 from public.score_memberships where team_id=p_team and user_id=p_user and role='admin') and p_role<>'admin' and
     (select count(*) from public.score_memberships where team_id=p_team and role='admin')<=1 then raise exception 'LAST_ADMIN'; end if;
  if p_role='remove' then delete from public.score_memberships where team_id=p_team and user_id=p_user;
  else update public.score_memberships set role=p_role where team_id=p_team and user_id=p_user; end if;
end $$;

revoke all on function public.score_create_team(text,text), public.score_save_book(uuid,bigint,jsonb,uuid), public.score_create_invite(uuid,text,text), public.score_accept_invite(text,text), public.score_revoke_invite(uuid,uuid), public.score_set_role(uuid,uuid,text) from public, anon;
grant execute on function public.score_create_team(text,text), public.score_save_book(uuid,bigint,jsonb,uuid), public.score_create_invite(uuid,text,text), public.score_accept_invite(text,text), public.score_revoke_invite(uuid,uuid), public.score_set_role(uuid,uuid,text) to authenticated;
