"use client";
import { useState } from 'react';
import { createInitialBook } from '@/lib/onboarding';
import { positions } from '@/lib/lineup-changes';
import { localDate, schoolYear, type Scorebook } from '@/lib/scorebook';
const input='mt-1 min-h-11 w-full rounded-control border border-line px-3 py-2';
export function Onboarding({ teamName='', save }: { teamName?:string; save:(book:Scorebook)=>Promise<void> }) {
  const [busy,setBusy]=useState(false); const [error,setError]=useState('');
  return <form className="space-y-4" onSubmit={async event=>{
    event.preventDefault(); if(busy)return; setBusy(true);setError('');const data=new FormData(event.currentTarget);
    try { const date=String(data.get('date')); const members=positions.map((position,index)=>({id:crypto.randomUUID(),name:String(data.get(`name-${index}`)).trim(),number:Number(data.get(`number-${index}`)),grade:String(data.get(`grade-${index}`)),gradeYear:schoolYear(localDate()),team:'top' as const,position,bats:'右' as const,throws:'右' as const}));
      await save(createInitialBook(String(data.get('team')),String(data.get('opponent')),date,members,crypto.randomUUID()));
    }catch(cause){setError(cause instanceof Error?cause.message:'登録できませんでした。');}finally{setBusy(false);}
  }}><fieldset disabled={busy} className="space-y-4">
    <h2 className="text-xl font-bold">チームと最初の試合を登録</h2>
    <div className="grid gap-3 sm:grid-cols-3"><label>チーム名<input name="team" required maxLength={60} defaultValue={teamName} className={input}/></label><label>対戦相手<input name="opponent" required maxLength={60} placeholder="対戦相手のチーム名" className={input}/></label><label>試合日<input name="date" type="date" required defaultValue={localDate()} className={input}/></label></div>
    <p className="text-sm text-muted">最初の打順9人を登録します。控え選手は後から追加できます。相手の選手は「相手1番」などの仮名で始め、分かった時点で編集できます。先攻・後攻は試合開始前に交換できます。</p>
    {positions.map((position,index)=><div key={position} className="grid grid-cols-[1fr_70px_80px] gap-2 rounded-control border border-line p-3"><label className="min-w-0 text-sm">{index+1}番・{position}<input aria-label={`${index+1}番の名前`} name={`name-${index}`} required maxLength={60} className={input}/></label><label className="text-sm">背番号<input aria-label={`${index+1}番の背番号`} type="number" name={`number-${index}`} min={0} max={999} required defaultValue={index+1} className={input}/></label><label className="text-sm">現在の学年<select name={`grade-${index}`} defaultValue="4年" className={input}>{[1,2,3,4,5,6].map(grade=><option key={grade}>{grade}年</option>)}<option>学年不明</option></select></label></div>)}
    <button className="min-h-11 rounded-control bg-primary px-4 font-bold text-white">{busy?'保存中…':'登録してスコアを始める'}</button>
  </fieldset>{error?<p role="alert" className="text-action">{error}</p>:null}</form>;
}
