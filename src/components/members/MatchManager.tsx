"use client";
import { useState } from "react";
import { createMatch, isDate, localDate, type Match, type Scorebook } from "@/lib/scorebook";
import type { Half } from "@/lib/types";

const input = "mt-1 min-h-11 w-full rounded-control border border-line bg-surface px-3 py-2";
type Props = { book: Scorebook; match: Match; save: (book: Scorebook) => Promise<boolean>; select: (id: string) => void; disabled: boolean };
export function MatchManager({ book, match, save, select, disabled }: Props) {
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  return <section aria-label="試合の管理" className="mb-4 rounded-card border border-line bg-surface p-4">
    <div className="flex flex-wrap items-end gap-3"><label className="min-w-0 flex-1 text-sm font-bold">表示する試合<select aria-label="表示する試合" className={input} disabled={disabled} value={match.id} onChange={event => select(event.target.value)}>{book.matches.map(item => <option key={item.id} value={item.id}>{item.date ?? "日付未設定"} ｜ {item.teams.away.name} vs {item.teams.home.name}</option>)}</select></label><button type="button" disabled={disabled} className="min-h-11 rounded-control border border-primary px-3 text-sm font-bold text-primary disabled:opacity-50" onClick={() => setCreating(!creating)}>{creating ? "作成を閉じる" : "新しい試合"}</button></div>
    {!match.date ? <p className="mt-2 text-sm text-muted">この記録には試合日がありません。期間別の成績に含めるには日付を設定してください。</p> : null}
    <details key={match.id} className="mt-3"><summary className="cursor-pointer text-sm font-bold text-primary">試合日・試合時の学年を設定</summary><form className="mt-3" onSubmit={async event => {
      event.preventDefault(); setError(""); const data = new FormData(event.currentTarget); const date = String(data.get("date"));
      if (!isDate(date)) { setError("正しい試合日を入力してください。"); return; }
      const updated = { ...match, date, players: match.players.map(player => ({ ...player, grade: String(data.get(`grade-${player.id}`)) })) };
      await save({ ...book, matches: book.matches.map(item => item.id === match.id ? updated : item) });
    }}><fieldset disabled={disabled} className="space-y-3"><label className="block max-w-xs text-sm">試合日<input required name="date" type="date" defaultValue={match.date ?? ""} className={input} /></label>
      <details><summary className="cursor-pointer text-sm">試合時の学年を確認・修正</summary><p className="my-2 text-xs text-muted">この試合の学年だけを修正します。メンバーの現在の学年や他の試合は変更しません。</p><div className="grid gap-2 sm:grid-cols-3">{match.players.map(player => <label key={player.id} className="text-sm">{player.name}<select name={`grade-${player.id}`} defaultValue={player.grade} className={input}>{[1, 2, 3, 4, 5, 6].map(grade => <option key={grade}>{grade}年</option>)}<option>学年不明</option></select></label>)}</div></details>
      <button className="min-h-11 rounded-control bg-primary px-4 text-sm font-bold text-white">試合情報を保存</button></fieldset></form></details>
    {creating ? <form className="mt-4 border-t border-line pt-4" onSubmit={async event => {
      event.preventDefault(); setError(""); const data = new FormData(event.currentTarget);
      try {
        const selected = Object.fromEntries((["top", "bottom"] as const).map(half => [half, Array.from({ length: 9 }, (_, index) => String(data.get(`${half}-${index}`)))])) as Record<Half, string[]>;
        const next = createMatch(book, crypto.randomUUID(), String(data.get("new-date")), String(data.get("away")), String(data.get("home")), selected);
        if (await save({ ...book, matches: [...book.matches, next], activeId: next.id })) setCreating(false);
      } catch (cause) { setError(cause instanceof Error ? cause.message : "入力内容を確認してください。"); }
    }}><fieldset disabled={disabled} className="space-y-4"><h2 className="font-bold">新しい試合を作成</h2><p className="text-xs text-muted">現在の試合を残したまま、新しいスコアを作ります。学年は試合日の年度から計算して保存します。</p>
      <div className="grid gap-3 sm:grid-cols-3"><label className="text-sm">新しい試合の日付<input name="new-date" type="date" required defaultValue={localDate()} className={input} /></label><label className="text-sm">先攻チーム名<input name="away" required maxLength={60} defaultValue={match.teams.away.name} className={input} /></label><label className="text-sm">後攻チーム名<input name="home" required maxLength={60} defaultValue={match.teams.home.name} className={input} /></label></div>
      <div className="grid gap-4 sm:grid-cols-2">{(["top", "bottom"] as const).map(half => { const members = book.members.filter(member => member.team === half); return <details key={half}><summary className="cursor-pointer text-sm font-bold">{half === "top" ? "先攻" : "後攻"}の打順（9人）</summary><div className="mt-2 space-y-2">{Array.from({ length: 9 }, (_, index) => <label key={index} className="flex items-center gap-2 text-sm"><span className="shrink-0">{index + 1}番</span><select aria-label={`${half === "top" ? "先攻" : "後攻"}${index + 1}番`} name={`${half}-${index}`} className={input} defaultValue={members[index]?.id ?? ""}><option value="">選択してください</option>{members.map(member => <option key={member.id} value={member.id}>{member.name}（背番号{member.number}）</option>)}</select></label>)}</div></details>; })}</div>
      <button className="min-h-11 rounded-control bg-primary px-4 text-sm font-bold text-white">この打順で試合を作成</button></fieldset></form> : null}
    {error ? <p role="alert" className="mt-3 text-sm text-action">{error}</p> : null}
  </section>;
}
