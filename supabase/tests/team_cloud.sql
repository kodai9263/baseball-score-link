\set ON_ERROR_STOP on
begin;
create function public.test_assert(ok boolean,label text) returns void language plpgsql as $$ begin if ok is distinct from true then raise exception 'FAILED: %',label; end if; end $$;
create function public.test_denied(command text,expected text) returns void language plpgsql as $$ begin
  begin execute command; exception when others then if position(expected in sqlerrm)>0 then return; else raise; end if; end;
  raise exception 'FAILED: operation unexpectedly allowed: %',command;
end $$;
insert into auth.users values
 ('00000000-0000-0000-0000-000000000001','owner@example.test',now()),
 ('00000000-0000-0000-0000-000000000002','editor@example.test',now()),
 ('00000000-0000-0000-0000-000000000003','viewer@example.test',now()),
 ('00000000-0000-0000-0000-000000000004','outside@example.test',now());
set role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',false);
select public.score_create_team('チームA','管理者A') as a \gset
select public.test_assert((select count(*)=1 from public.score_teams),'owner sees team');
select public.test_denied(format('update public.score_books set revision=99 where team_id=%L',:'a'),'permission denied');
select public.test_denied(format('select public.score_set_role(%L,%L,%L)',:'a','00000000-0000-0000-0000-000000000001','remove'),'LAST_ADMIN');
select public.score_create_invite(:'a','editor@example.test','editor') as editor_token \gset
select public.score_create_invite(:'a','viewer@example.test','viewer') as viewer_token \gset
select public.test_denied('select token_hash from public.score_invites','permission denied');
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000004',false);
select public.score_create_team('チームB','管理者B') as b \gset
select public.test_assert((select count(*)=1 from public.score_teams),'outsider only sees own team');
select public.test_assert((select count(*)=0 from public.score_books where team_id=:'a'),'cross team book blocked');
select public.test_assert((select count(*)=0 from public.score_memberships where team_id=:'a'),'cross team members blocked');
select public.test_denied(format('select public.score_accept_invite(%L,%L)',:'editor_token','偽装'),'INVALID_INVITE');
select public.test_denied(format('select public.score_save_book(%L,0,%L::jsonb,gen_random_uuid())',:'a','{"version":2,"members":[],"matches":[{"id":"m"}],"activeId":"m"}'),'FORBIDDEN');
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000002',false);
select public.score_accept_invite(:'editor_token','記録者');
select public.test_assert(public.score_role(:'a')='editor','invite role bound');
select public.test_denied(format('select public.score_accept_invite(%L,%L)',:'editor_token','記録者'),'INVALID_INVITE');
select public.test_denied(format('select public.score_create_invite(%L,%L,%L)',:'a','viewer@example.test','editor'),'FORBIDDEN');
select public.test_denied(format('select public.score_set_role(%L,%L,%L)',:'a','00000000-0000-0000-0000-000000000002','admin'),'FORBIDDEN');
select public.test_assert(public.score_save_book(:'a',0,'{"version":2,"members":[],"matches":[{"id":"m"}],"activeId":"m"}','10000000-0000-0000-0000-000000000001')=1,'editor can save');
select public.test_assert(public.score_save_book(:'a',0,'{"version":2,"members":[],"matches":[{"id":"m"}],"activeId":"m"}','10000000-0000-0000-0000-000000000001')=1,'retry idempotent');
select public.test_denied(format('select public.score_save_book(%L,0,%L::jsonb,gen_random_uuid())',:'a','{"version":2,"members":[],"matches":[{"id":"m"}],"activeId":"m"}'),'REVISION_CONFLICT');
select public.test_denied(format('select public.score_save_book(%L,1,%L::jsonb,gen_random_uuid())',:'a','{"version":2,"members":[],"matches":[],"activeId":"m"}'),'INVALID_BOOK');
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000003',false);
select public.score_accept_invite(:'viewer_token','閲覧者');
select public.test_assert((select revision=1 from public.score_books where team_id=:'a'),'viewer reads saved book');
select public.test_denied(format('select public.score_save_book(%L,1,%L::jsonb,gen_random_uuid())',:'a','{"version":2,"members":[],"matches":[{"id":"m"}],"activeId":"m"}'),'FORBIDDEN');
select public.test_assert((select count(*)=0 from public.score_invites),'viewer cannot see invites');
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',false);
select public.score_set_role(:'a','00000000-0000-0000-0000-000000000002','remove');
select public.score_create_invite(:'a','editor@example.test','editor') as revoked_token \gset
select id as revoked_id from public.score_invites where email='editor@example.test' and used_at is null \gset
select public.score_revoke_invite(:'a',:'revoked_id');
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000002',false);
select public.test_assert((select count(*)=0 from public.score_books where team_id=:'a'),'removed member loses reads');
select public.test_denied(format('select public.score_accept_invite(%L,%L)',:'revoked_token','記録者'),'INVALID_INVITE');
select public.test_denied(format('select public.score_save_book(%L,1,%L::jsonb,gen_random_uuid())',:'a','{"version":2,"members":[],"matches":[{"id":"m"}],"activeId":"m"}'),'FORBIDDEN');
reset role;
set role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',false);
select public.score_create_invite(:'a','editor@example.test','editor') as expired_token \gset
reset role;
update public.score_invites set expires_at=now()-interval '1 day' where used_at is null and revoked_at is null;
set role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000002',false);
select public.test_denied(format('select public.score_accept_invite(%L,%L)',:'expired_token','記録者'),'INVALID_INVITE');
reset role;
update public.score_invites set expires_at=now()+interval '1 day' where used_at is null and revoked_at is null;
update auth.users set email_confirmed_at=null where id='00000000-0000-0000-0000-000000000002';
set role authenticated;
select public.test_denied(format('select public.score_accept_invite(%L,%L)',:'expired_token','未確認の記録者'),'INVALID_INVITE');
reset role;
set role anon;
select public.test_denied(format('select public.score_create_team(%L,%L)','侵入','匿名'),'permission denied');
select public.test_denied('select * from public.score_books','permission denied');
reset role;
rollback;
\echo 'Team RLS, roles, invites and revision tests passed'
