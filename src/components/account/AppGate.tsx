"use client";
import { useEffect,useMemo,useRef,useState,type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { BOOK_KEY,BOOK_LOCK,createBook,decodeBook,saveBook,type Scorebook } from '@/lib/scorebook';
import { GAME_STORAGE_KEY } from '@/lib/game-storage';
import { createCloudStore,cloudError,roleLabels,type CloudSnapshot,type TeamRole } from '@/lib/cloud-book';
import { AuthPanel } from './AuthPanel';
import { Onboarding } from './Onboarding';
import { StorageContext } from './StorageContext';
import { TeamAdmin } from './TeamAdmin';
const card='mx-auto my-6 max-w-3xl rounded-card border border-line bg-surface p-4 sm:p-6';
function localBook():Scorebook|null {const raw=localStorage.getItem(BOOK_KEY);const old=localStorage.getItem(GAME_STORAGE_KEY);return raw!==null?decodeBook(raw):old!==null?createBook(old):null;}
function LocalWorkspace({children}:{children:ReactNode}) {
  const [state,setState]=useState<'loading'|'new'|'ready'|'error'>('loading');
  useEffect(()=>{try{setState(localBook()?'ready':'new');}catch{setState('error');}},[]);
  if(state==='ready')return children;
  return <section className={card}>{state==='new'?<Onboarding save={async book=>{if(!navigator.locks)throw new Error('対応ブラウザで開いてください。');await navigator.locks.request(BOOK_LOCK,()=>saveBook(localStorage,null,null,book));setState('ready');}}/>:<p role="status">{state==='error'?'端末内の記録を読み込めません。元データは変更していません。':'記録を確認しています…'}</p>}</section>;
}
type Team={id:string;name:string;role:TeamRole};
function CloudWorkspace({team,userId,children}:{team:Team;userId:string;children:ReactNode}) {
  const store=useMemo(()=>createCloudStore(supabase!,team.id,team.name,team.role),[team.id,team.name,team.role]);
  const [snapshot,setSnapshot]=useState<CloudSnapshot|null>(null);const [error,setError]=useState('');const [retry,setRetry]=useState(0);const [migration,setMigration]=useState<Scorebook|null>(null);const [busy,setBusy]=useState(false);
  useEffect(()=>{let live=true;store.load().then(result=>{if(live){setSnapshot(result);setError('');}}).catch(e=>{if(live)setError(cloudError(e));});return()=>{live=false;};},[store,retry]);
  if(error)return <section className={card}><p role="alert">{error}</p><button onClick={()=>setRetry(n=>n+1)} className="min-h-11 underline">再接続する</button></section>;
  if(!snapshot)return <p className={card}>チームの記録を読み込んでいます…</p>;
  if(snapshot.book)return <StorageContext.Provider key={`${userId}-${team.id}`} value={{store,initial:snapshot}}>{children}</StorageContext.Provider>;
  const initialize=async(book:Scorebook)=>{if(busy)return;setBusy(true);try{const revision=await store.save(book,snapshot.revision,crypto.randomUUID());setSnapshot({book,revision});}catch(e){setError(cloudError(e));}finally{setBusy(false);}};
  return <section className={card}>{team.role==='viewer'?<p>まだ記録がありません。管理者・記録者の登録をお待ちください。<button onClick={()=>setRetry(n=>n+1)} className="min-h-11 underline">更新</button></p>:<>
    <details className="mb-5"><summary className="cursor-pointer font-bold">この端末の記録をチームへ移す</summary><p className="my-2 text-sm">コピー後はチームの参加者が閲覧できます。端末内の元データは残ります。</p><button disabled={busy} className="min-h-11 underline" onClick={()=>{try{const found=localBook();if(!found){setError('この端末に保存した記録はありません。');return;}setMigration(found);}catch{setError('端末内の記録を読み込めませんでした。');}}}>移す内容を確認</button>
    {migration?<div className="space-y-2"><p>{migration.members.length}人・{migration.matches.length}試合を「{team.name}」へコピーします。</p><button disabled={busy} className="min-h-11 rounded-control bg-primary px-3 text-white" onClick={()=>void initialize(migration)}>この記録をチームにコピー</button></div>:null}</details>
    <Onboarding teamName={team.name} save={initialize}/></>}</section>;
}
export function AppGate({children}:{children:ReactNode}) {
  const [session,setSession]=useState<Session|null>(null);const [authReady,setAuthReady]=useState(!supabase);const [local,setLocal]=useState(!supabase);
  const [teams,setTeams]=useState<Team[]>([]);const [active,setActive]=useState('');const [generation,setGeneration]=useState(0);const [error,setError]=useState('');const [busy,setBusy]=useState(false);
  const identity=useRef<string|undefined>(undefined);
  useEffect(()=>{
    if(!supabase)return;let live=true;let authChanged=false;
    const applySession=(next:Session|null)=>{if(!live)return;if(identity.current!==next?.user.id){identity.current=next?.user.id;setTeams([]);setActive('');setError('');}setSession(next);setAuthReady(true);};
    void supabase.auth.getSession().then(({data,error})=>{if(live&&!authChanged){applySession(data.session);if(error)setError('ログイン情報を確認できませんでした。');}});
    const {data}=supabase.auth.onAuthStateChange((_event,next)=>{authChanged=true;applySession(next);});
    return()=>{live=false;data.subscription.unsubscribe();};
  },[]);
  useEffect(()=>{if(!session||!supabase||local)return;let live=true;
    const refresh=async()=>{const [t,m]=await Promise.all([supabase!.from('score_teams').select('id,name'),supabase!.from('score_memberships').select('team_id,role').eq('user_id',session.user.id)]);if(!live)return;if(t.error||m.error){setError(cloudError(t.error??m.error));return;}const found=(t.data??[]).map(team=>({...team,role:m.data?.find(row=>row.team_id===team.id)?.role as TeamRole})).filter(team=>team.role);setTeams(found);setActive(id=>found.some(team=>team.id===id)?id:found[0]?.id??'');setError('');};
    void refresh();const timer=setInterval(()=>void refresh(),20000);return()=>{live=false;clearInterval(timer);};
  },[session,local,generation]);
  const team=teams.find(item=>item.id===active);
  const join=async(event:React.FormEvent<HTMLFormElement>,create:boolean)=>{event.preventDefault();if(busy||!supabase)return;setBusy(true);setError('');const data=new FormData(event.currentTarget);try{const result=create?await supabase.rpc('score_create_team',{p_name:String(data.get('team')),p_display_name:String(data.get('name'))}):await supabase.rpc('score_accept_invite',{p_token:String(data.get('token')).trim(),p_display_name:String(data.get('name'))});if(result.error)throw result.error;setActive(result.data);setGeneration(n=>n+1);}catch(e){setError(cloudError(e));}finally{setBusy(false);}};
  if(!authReady)return <p className={card}>ログインを確認しています…</p>;
  if(local)return <><div className="mx-auto max-w-3xl p-3 text-sm text-muted">端末保存モード{supabase?<button className="ml-3 min-h-11 underline" onClick={()=>setLocal(false)}>ログインしてチームで共有</button>:null}</div><LocalWorkspace>{children}</LocalWorkspace></>;
  if(!session)return <section className={card}><AuthPanel/>{error?<p role="alert">{error}</p>:null}<button className="mt-4 min-h-11 underline" onClick={()=>setLocal(true)}>ログインせず端末内で使う</button></section>;
  return <><section className="mx-auto max-w-[1280px] space-y-3 p-4"><div className="flex flex-wrap items-center gap-3"><span className="min-w-0 flex-1 break-all text-sm">{session.user.email}</span><button className="min-h-11 underline" onClick={async()=>{const {error}=await supabase!.auth.signOut({scope:'local'});if(error)setError('ログアウトできませんでした。再度お試しください。');}}>ログアウト</button></div>
    {teams.length?<label className="block">共有するチーム<select value={active} onChange={e=>setActive(e.target.value)} className="ml-2 min-h-11 max-w-full rounded-control border border-line px-3">{teams.map(team=><option key={team.id} value={team.id}>{team.name}（{roleLabels[team.role]}）</option>)}</select></label>:null}
    <details data-account-panel open={!teams.length} className="rounded-card border border-line bg-surface p-4"><summary className="cursor-pointer font-bold">チームを作成・招待に参加</summary><div className="mt-3 grid gap-5 sm:grid-cols-2">
      <form className="space-y-2" onSubmit={e=>void join(e,true)}><h2 className="font-bold">新しいチーム</h2><label className="block">チーム名<input name="team" required maxLength={60} className="block min-h-11 w-full rounded border border-line px-3"/></label><label className="block">あなたの表示名<input name="name" required maxLength={60} className="block min-h-11 w-full rounded border border-line px-3"/></label><button disabled={busy} className="min-h-11 rounded-control bg-primary px-3 text-white">チームを作成</button></form>
      <form className="space-y-2" onSubmit={e=>void join(e,false)}><h2 className="font-bold">招待に参加</h2><label className="block">招待コード<input name="token" required maxLength={64} className="block min-h-11 w-full rounded border border-line px-3"/></label><label className="block">あなたの表示名<input name="name" required maxLength={60} className="block min-h-11 w-full rounded border border-line px-3"/></label><p className="text-xs">招待されたメールアドレスでログインしてください。</p><button disabled={busy} className="min-h-11 rounded-control border border-primary px-3">このチームに参加</button></form>
    </div></details>{error?<p role="alert" className="text-action">{error}</p>:null}
    {team?.role==='admin'?<TeamAdmin key={team.id} teamId={team.id} onChanged={()=>setGeneration(n=>n+1)}/>:null}
  </section>{team?<CloudWorkspace key={`${session.user.id}-${team.id}-${team.role}`} team={team} userId={session.user.id}>{children}</CloudWorkspace>:null}</>;
}
