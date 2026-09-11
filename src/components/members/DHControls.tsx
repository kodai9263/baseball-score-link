"use client";
import { useState } from "react";
import { currentLineupState, defaultSources, positions } from "@/lib/lineup-changes";
import { endDH, substitute, type Match, type Scorebook } from "@/lib/scorebook";
import type { DHEnd, Half } from "@/lib/types";

const input = "mt-1 min-h-11 w-full rounded-control border border-line bg-surface px-3 py-2";
export function DHControls({ book, match, team, save, disabled }: { book: Scorebook; match: Match; team: Half; save: (match: Match) => Promise<boolean>; disabled: boolean }) {
  const attacking = match.game.half === team;
  const [mode, setMode] = useState<DHEnd>(attacking ? "pitcher_bats" : "dh_fields");
  const [position, setPosition] = useState("投手");
  const [error, setError] = useState("");
  const active = currentLineupState(match);
  const pitcherId = active.pitchers[team];
  const dh = active.lineups[team].find(slot => slot.position === "DH");
  const name = (id: string) => match.players.find(player => player.id === id)!.name;
  if (!pitcherId || !dh) return <p className="mt-3 text-xs text-muted">DH：{match.dh?.[team] ? "解除済み（この試合では再び使えません）" : "使用なし（新しい試合の作成時に選べます）"}</p>;
  const used = new Set([...match.players.filter(player => Object.values(match.lineups).flat().some(slot => slot.playerId === player.id)).map(player => player.id),
    ...Object.values(match.dh ?? {}).map(setup => setup.pitcherId), ...(match.changes ?? []).map(change => change.incomingId)]);
  const bench = book.members.filter(member => member.team === (match.teamSources ?? defaultSources)[team] && !used.has(member.id));
  const target = active.lineups[team].find(slot => slot.position === position);
  const canBat = dh.order === match.game.battingOrderIndex[team] % 9 + 1 || Object.values(match.game.bases).includes(dh.playerId);
  const preview = mode === "pitcher_bats" ? `${dh.order}番 ${name(dh.playerId)}に代わって${name(pitcherId)}が入ります。塁上のDHも投手に交代します。` : mode === "dh_fields" ?
    `${name(dh.playerId)}は${dh.order}番のまま${position}へ。${position === "投手" ? `${name(pitcherId)}は退きます。` : `${target?.order}番 ${target ? name(target.playerId) : ""}が退き、${name(pitcherId)}がその打順で投手を続けます。`}` :
    `${name(pitcherId)}が${dh.order}番・${position}に入り、${target?.order}番 ${target ? name(target.playerId) : ""}が投手へ。${name(dh.playerId)}は退きます。`;
  return <section aria-label="DHと投手" className="mt-4 space-y-3 border-t border-line pt-3">
    <p className="text-sm font-bold">DH：{dh.order}番 {name(dh.playerId)} ／ 投手：{name(pitcherId)}</p>
    <p className="text-xs text-muted">先発DHの初打席完了など、交代できる条件は大会ルールに従って確認してください。</p>
    {!attacking ? <form onSubmit={async event => {
      event.preventDefault(); setError(""); const data = new FormData(event.currentTarget);
      try { await save(substitute(book, match, team, 0, String(data.get("pitcher")), "pitcher", "投手", crypto.randomUUID())); }
      catch (cause) { setError(cause instanceof Error ? cause.message : "投手を交代できませんでした。"); }
    }}><fieldset disabled={disabled || !bench.length}>
      <label className="block text-sm">交代する投手<select className={input} required name="pitcher" defaultValue=""><option value="">控え選手を選択</option>{bench.map(member => <option key={member.id} value={member.id}>{member.name}（背番号{member.number}）</option>)}</select></label>
      <button className="mt-2 min-h-11 rounded-control border border-primary px-3 text-sm font-bold text-primary disabled:opacity-50">DHを維持して投手交代</button>
    </fieldset>{!bench.length ? <p className="text-xs text-muted">投手交代には控え選手の登録が必要です。</p> : null}</form> : null}
    <details><summary className="cursor-pointer text-sm font-bold text-primary">DH解除</summary>
      <form className="mt-3" onSubmit={async event => {
        event.preventDefault(); setError("");
        try { await save(endDH(match, team, mode, mode === "pitcher_bats" ? "投手" : position, crypto.randomUUID())); }
        catch (cause) { setError(cause instanceof Error ? cause.message : "DHを解除できませんでした。"); }
      }}><fieldset disabled={disabled} className="space-y-3">
        <label className="block text-sm">解除する理由<select className={input} value={mode} onChange={event => { const value = event.target.value as DHEnd; setMode(value); setPosition(value === "pitcher_fields" ? "捕手" : "投手"); }}>
          {attacking ? <option value="pitcher_bats">投手がDHの代打・代走になる</option> : <><option value="dh_fields">DHが守備につく</option><option value="pitcher_fields">投手と野手の守備を入れ替える</option></>}
        </select></label>
        {!attacking ? <label className="block text-sm">{mode === "dh_fields" ? "DH" : "投手"}の新しい守備位置<select className={input} value={position} onChange={event => setPosition(event.target.value)}>{positions.filter(item => mode !== "pitcher_fields" || item !== "投手").map(item => <option key={item}>{item}</option>)}</select></label> : null}
        <p className="text-sm">{preview}</p>
        <p className="text-xs text-muted">解除後は、この試合でDHを再び使えません。誤操作は「取消」で戻せます。</p>
        {attacking && !canBat ? <p className="text-sm text-muted">DHの打席、またはDHが塁上にいるときに記録できます。</p> : null}
        <button disabled={disabled || (attacking && !canBat)} className="min-h-11 rounded-control bg-primary px-3 text-sm font-bold text-white disabled:opacity-50">この配置でDHを解除</button>
      </fieldset></form>
    </details>
    {error ? <p role="alert" className="text-sm text-action">{error}</p> : null}
  </section>;
}
