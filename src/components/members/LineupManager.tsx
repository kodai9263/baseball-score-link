"use client";
import { useState } from "react";
import { currentLineupState, changeLabels, defaultSources, positions } from "@/lib/lineup-changes";
import { substitute, type Match, type Scorebook } from "@/lib/scorebook";
import { DHControls } from "./DHControls";
import type { Half, LineupChange } from "@/lib/types";

const input = "mt-1 min-h-11 w-full rounded-control border border-line bg-surface px-3 py-2";
export function LineupManager({ book, match, save, disabled }: { book: Scorebook; match: Match; save: (match: Match) => Promise<boolean>; disabled: boolean }) {
  const [team, setTeam] = useState<Half>(match.game.half);
  const [kind, setKind] = useState<LineupChange["kind"]>("hitter");
  const [order, setOrder] = useState(1);
  const [error, setError] = useState("");
  const active = currentLineupState(match);
  const lineup = active.lineups[team];
  const actualOrder = kind === "hitter" ? match.game.battingOrderIndex[team] % 9 + 1 : order;
  const slot = lineup[actualOrder - 1];
  const getName = (id: string) => match.players.find(player => player.id === id)!.name;
  const used = new Set([...Object.values(match.lineups).flat().map(slot => slot.playerId), ...Object.values(match.dh ?? {}).map(setup => setup.pitcherId), ...(match.changes ?? []).map(change => change.incomingId)]);
  const bench = book.members.filter(member => member.team === (match.teamSources ?? defaultSources)[team] && !used.has(member.id));
  const orders = kind === "runner" ? lineup.filter(slot => Object.values(match.game.bases).includes(slot.playerId)) : lineup.filter(slot => slot.position !== "DH");
  const last = match.changes?.at(-1);
  return <details className="mb-4 rounded-card border border-line bg-surface p-4">
    <summary className="cursor-pointer text-sm font-bold text-primary">選手交代・守備位置</summary>
    <form className="mt-3 space-y-3" onSubmit={async event => {
      event.preventDefault(); setError("");
      const data = new FormData(event.currentTarget);
      try {
        const next = substitute(book, match, team, actualOrder, kind === "position" ? slot.playerId : String(data.get("incoming")), kind,
          kind === "hitter" || kind === "runner" ? slot.position : String(data.get("position")), crypto.randomUUID());
        await save(next);
      } catch (cause) { setError(cause instanceof Error ? cause.message : "交代内容を確認してください。"); }
    }}><fieldset disabled={disabled} className="space-y-3">
      <label className="block text-sm">交代するチーム<select className={input} value={team} onChange={event => {
        const next = event.target.value as Half; setTeam(next); setKind(next === match.game.half ? "hitter" : "defense"); setOrder(active.lineups[next].find(slot => slot.position !== "DH")?.order ?? 1); setError("");
      }}><option value="top">先攻：{match.teams.away.name}</option><option value="bottom">後攻：{match.teams.home.name}</option></select></label>
      <label className="block text-sm">交代の種類<select className={input} value={kind} onChange={event => {
        const next = event.target.value as LineupChange["kind"]; setKind(next); setError("");
        setOrder(next === "runner" ? lineup.find(slot => Object.values(match.game.bases).includes(slot.playerId))?.order ?? 1 : lineup.find(slot => slot.position !== "DH")?.order ?? 1);
      }}>{(team === match.game.half ? ["hitter", "runner"] as const : ["defense", "position"] as const).map(kind => <option key={kind} value={kind}>{changeLabels[kind]}</option>)}</select></label>
      {kind === "hitter" ? <p className="text-sm">交代する打者：{actualOrder}番 {getName(slot.playerId)}</p> :
        <label className="block text-sm">交代する選手<select className={input} value={order} onChange={event => setOrder(Number(event.target.value))}>{orders.map(slot => <option key={slot.order} value={slot.order}>{slot.order}番 {getName(slot.playerId)}（{slot.position}）</option>)}</select></label>}
      {kind !== "position" ? <label className="block text-sm">入る選手<select key={`${team}-${kind}`} required name="incoming" defaultValue="" className={input}><option value="">控え選手を選んでください</option>{bench.map(member => <option key={member.id} value={member.id}>{member.name}（背番号{member.number}）</option>)}</select></label> : null}
      {kind === "defense" || kind === "position" ? <label className="block text-sm">交代後の守備位置<select key={`${team}-${order}`} name="position" defaultValue={slot.position} className={input}>{positions.filter(position => !active.pitchers[team] || position !== "投手").map(position => <option key={position}>{position}</option>)}</select></label> : null}
      <p className="text-xs text-muted">打順はそのまま引き継ぎます。退いた選手の再出場には対応していません。守備位置を変更すると、その位置の選手と守備を入れ替えます。</p>
      {kind !== "position" && !bench.length ? <p className="text-sm text-muted">控え選手がいません。「メンバー・成績」で同じ所属グループに選手を追加してください。</p> : null}
      {kind === "runner" && !orders.length ? <p className="text-sm text-muted">塁上に走者がいません。</p> : null}
      <button disabled={disabled || (kind !== "position" && !bench.length) || (kind === "runner" && !orders.length)} className="min-h-11 rounded-control bg-primary px-4 text-sm font-bold text-white disabled:opacity-50">この内容で交代を記録</button>
    </fieldset></form>
    {error ? <p role="alert" className="mt-2 text-sm text-action">{error}</p> : null}
    <DHControls key={team} book={book} match={match} team={team} save={save} disabled={disabled} />
    {last ? <p role="status" className="mt-3 text-sm">直近の交代：{last.order ? `${last.order}番` : "打順外の投手"} {getName(last.outgoingId)} → {getName(last.incomingId)}（{changeLabels[last.kind]}・{last.position}）。取消ボタンは交代も含め、最後の操作から戻します。</p> : null}
    {!!match.changes?.length && <ol aria-label="交代履歴" className="mt-3 space-y-1 text-xs text-muted">{match.changes.map(change => <li key={change.id}>{change.beforePlay}プレー記録後・{change.team === "top" ? "先攻" : "後攻"}{change.order ? `${change.order}番` : "投手"} {getName(change.outgoingId)} → {getName(change.incomingId)}／{changeLabels[change.kind]}・{change.position}</li>)}</ol>}
  </details>;
}
