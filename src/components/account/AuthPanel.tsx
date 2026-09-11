"use client";
import { useState } from 'react';
import { supabase } from '@/lib/supabase';
export function AuthPanel() {
  const [email,setEmail]=useState('');const [sent,setSent]=useState(false);const [token,setToken]=useState('');const [busy,setBusy]=useState(false);const [error,setError]=useState('');
  return <form className="space-y-4" onSubmit={async event=>{event.preventDefault();if(busy||!supabase)return;setBusy(true);setError('');try{
    const result=sent?await supabase.auth.verifyOtp({email:email.trim(),token:token.trim(),type:'email'}):await supabase.auth.signInWithOtp({email:email.trim(),options:{shouldCreateUser:true}});
    if(result.error)throw result.error; if(!sent)setSent(true);
  }catch{setError(sent?'コードが無効または期限切れです。メールを確認し、必要なら再送してください。':'メールを送れませんでした。アドレスを確認し、少し待ってからお試しください。');}finally{setBusy(false);}}}>
    <h1 className="text-2xl font-bold">チームのスコアを共有</h1><p className="text-sm text-muted">メールに届く確認コードで登録・ログインできます。パスワードは不要です。</p>
    <label className="block">メールアドレス<input type="email" required autoComplete="email" maxLength={254} readOnly={sent} value={email} onChange={e=>setEmail(e.target.value)} className="mt-1 min-h-11 w-full rounded-control border border-line px-3"/></label>
    {sent?<label className="block">確認コード<input required inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6,10}" value={token} onChange={e=>setToken(e.target.value)} className="mt-1 min-h-11 w-full rounded-control border border-line px-3"/></label>:null}
    <button disabled={busy} className="min-h-11 rounded-control bg-primary px-4 font-bold text-white disabled:opacity-50">{busy?'処理中…':sent?'ログインする':'確認コードを送る'}</button>
    {sent?<button type="button" disabled={busy} onClick={()=>{setSent(false);setToken('');setError('');}} className="ml-3 min-h-11 underline">メール変更・再送</button>:null}
    {sent?<p role="status" className="text-sm">メールに届いた確認コードを入力してください。</p>:null}{error?<p role="alert" className="text-action">{error}</p>:null}
  </form>;
}
