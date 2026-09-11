"use client";
import { useState } from "react";
import { defaultSources } from "@/lib/lineup-changes";
import { average, localDate, memberStats, schoolYear, type Member, type Scorebook } from "@/lib/scorebook";

const field = "mt-1 min-h-11 w-full rounded-control border border-line bg-surface px-3 py-2 text-ink";
const action = "min-h-11 rounded-control bg-primary px-4 py-2 text-sm font-bold text-white disabled:opacity-50";
type Props = { book: Scorebook; selectedId: string | null; select: (id: string | null) => void; save: (book: Scorebook) => Promise<boolean>; disabled: boolean; readOnly?: boolean; openMatch: (id: string) => void };

function memberTeamNames(book: Scorebook) {
  const match = book.matches.find(match => match.id === book.activeId)!;
  const sources = match.teamSources ?? defaultSources;
  return sources.top === "top" ? { top: match.teams.away.name, bottom: match.teams.home.name } : { top: match.teams.home.name, bottom: match.teams.away.name };
}

export function MemberPanel({ book, selectedId, select, save, disabled, readOnly=false, openMatch }: Props) {
  const [query, setQuery] = useState("");
  const [team, setTeam] = useState("top");
  const names = memberTeamNames(book);
  const member = book.members.find(item => item.id === selectedId);
  if (member) return <MemberDetail key={member.id} member={member} book={book} back={() => select(null)} save={save} disabled={disabled} readOnly={readOnly} openMatch={openMatch} />;
  return <section className="space-y-4" aria-label="メンバー一覧">
    <div><h1 className="text-xl font-bold">メンバー・成績</h1><p className="mt-1 text-sm text-muted">名前を押すと、通算・学年別・試合ごとの成績を見られます。</p></div>
    <div className="grid gap-3 sm:grid-cols-2"><label className="text-sm">メンバーを検索<input className={field} value={query} onInput={event => setQuery(event.currentTarget.value)} onChange={event => setQuery(event.target.value)} placeholder="名前・背番号" /></label>
      <label className="text-sm">所属<select className={field} value={team} onChange={event => setTeam(event.target.value)}><option value="top">{names.top}の登録メンバー</option><option value="bottom">{names.bottom}の登録メンバー</option><option value="">すべて</option></select></label></div>
    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{book.members.filter(item => (!team || item.team === team) && `${item.name} ${item.number}`.includes(query.trim())).map(item => {
      const stats = memberStats(book.matches, item.id);
      return <button key={item.id} type="button" className="flex min-h-20 items-center justify-between gap-3 rounded-card border border-line bg-surface p-4 text-left hover:border-primary" onClick={() => select(item.id)} aria-label={`${item.name}の成績を見る`}>
        <span><strong className="block">{item.name}</strong><span className="text-xs text-muted">背番号 {item.number} · {item.gradeYear}年度 {item.grade}</span></span>
        <span className="text-right"><strong className="block text-xl tabular-nums text-primary-dark">{stats.average}</strong><span className="text-xs text-muted">通算打率 · {stats.atBats}打数</span></span>
      </button>;
    })}</div>
    {!book.members.some(item => (!team || item.team === team) && `${item.name} ${item.number}`.includes(query.trim())) ? <p className="py-6 text-center text-muted">一致するメンバーがいません。</p> : null}
    {!readOnly ? <details className="rounded-card border border-line bg-surface p-4"><summary className="cursor-pointer font-bold">メンバーを登録する</summary><MemberForm book={book} key={`new-${book.members.length}`} save={async member => save({ ...book, members: [...book.members, member] })} disabled={disabled} /></details> : null}
  </section>;
}

function MemberForm({ book, member, save, disabled }: { book: Scorebook; member?: Member; save: (member: Member) => Promise<boolean>; disabled: boolean }) {
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const names = memberTeamNames(book);
  return <form className="mt-3" onSubmit={async event => {
    event.preventDefault(); setError(""); setDone(false);
    const data = new FormData(event.currentTarget);
    const name = String(data.get("name")).trim();
    if (!name) { setError("名前を入力してください。"); return; }
    const next: Member = { id: member?.id ?? crypto.randomUUID(), name, number: Number(data.get("number")), grade: String(data.get("grade")),
      gradeYear: Number(data.get("year")), team: String(data.get("team")) as Member["team"], position: String(data.get("position")), bats: String(data.get("bats")) as Member["bats"], throws: member?.throws ?? "右" };
    if (await save(next)) setDone(true);
  }}><fieldset disabled={disabled} className="grid gap-3 sm:grid-cols-2">
    <label className="text-sm">名前<input name="name" required maxLength={40} defaultValue={member?.name} className={field} /></label>
    <label className="text-sm">背番号<input name="number" type="number" required min={0} max={999} defaultValue={member?.number ?? 0} className={field} /></label>
    <label className="text-sm">学年<select name="grade" defaultValue={member?.grade ?? "4年"} className={field}>{[1, 2, 3, 4, 5, 6].map(grade => <option key={grade}>{grade}年</option>)}<option>学年不明</option></select></label>
    <label className="text-sm">学年の基準年度<input name="year" type="number" min={1900} max={2200} required defaultValue={member?.gradeYear ?? schoolYear(localDate())} className={field} /></label>
    <label className="text-sm">登録する側<select name="team" defaultValue={member?.team ?? "top"} className={field}><option value="top">{names.top}</option><option value="bottom">{names.bottom}</option></select></label>
    <label className="text-sm">守備位置<select name="position" defaultValue={member?.position ?? "投手"} className={field}>{["投手", "捕手", "一塁手", "二塁手", "三塁手", "遊撃手", "左翼手", "中堅手", "右翼手"].map(position => <option key={position}>{position}</option>)}</select></label>
    <label className="text-sm">打席<select name="bats" defaultValue={member?.bats ?? "右"} className={field}>{["右", "左", "両"].map(bats => <option key={bats}>{bats}</option>)}</select></label>
    <p className="text-xs text-muted sm:col-span-2">年度は4月始まりです。変更は今後作る試合に適用し、記録済みの試合の名前・学年はそのまま残します。</p>
    <button className={action}>{member ? "メンバー情報を保存" : "メンバーを登録"}</button>
  </fieldset>{error ? <p role="alert" className="mt-2 text-sm text-action">{error}</p> : null}{done ? <p role="status" className="mt-2 text-sm text-primary">保存しました。</p> : null}</form>;
}

function MemberDetail({ member, book, back, save, disabled, readOnly=false, openMatch }: { member: Member; book: Scorebook; back: () => void; save: Props["save"]; disabled: boolean; readOnly?: boolean; openMatch: Props["openMatch"] }) {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [grade, setGrade] = useState("");
  const invalid = !!from && !!to && from > to;
  const stats = memberStats(book.matches, member.id, { from, to, grade });
  const grades = [...new Set(book.matches.flatMap(match => match.players.filter(player => player.id === member.id).map(player => player.grade)))].sort();
  const today = localDate();
  const recent = new Date(); recent.setDate(recent.getDate() - 89);
  const presetActive = (value: string) => value === "all" ? !from && !to && !grade : to === today && from === (value === "year" ? `${schoolYear(today)}-04-01` : localDate(recent));
  const preset = (value: string) => {
    if (value === "all") { setFrom(""); setTo(""); setGrade(""); return; }
    const today = localDate();
    setTo(today);
    if (value === "year") setFrom(`${schoolYear(today)}-04-01`);
    else { const date = new Date(); date.setDate(date.getDate() - 89); setFrom(localDate(date)); }
  };
  return <section className="space-y-5" aria-label={`${member.name}の個人成績`}>
    <button type="button" onClick={back} className="min-h-11 text-sm font-bold text-primary">← メンバー一覧</button>
    <div><p className="text-sm text-muted">背番号 {member.number} · {member.gradeYear}年度 {member.grade}</p><h1 className="text-2xl font-bold">{member.name}<span className="ml-3 text-sm font-normal text-muted">個人成績</span></h1></div>
    <div className="rounded-card border border-line bg-surface p-4"><div className="flex flex-wrap gap-2">{[["all", "通算"], ["year", "今年度"], ["recent", "直近90日"]].map(([value, label]) => <button key={value} type="button" aria-pressed={presetActive(value)} onClick={() => preset(value)} className={`min-h-11 rounded-control border px-4 text-sm font-bold ${presetActive(value) ? "border-primary bg-primary-soft text-primary-dark" : "border-line hover:bg-sunken"}`}>{label}</button>)}</div>
      <div className="mt-3 grid gap-3 sm:grid-cols-3"><label className="text-sm">開始日<input type="date" value={from} onInput={event => setFrom(event.currentTarget.value)} onChange={event => setFrom(event.target.value)} className={field} /></label><label className="text-sm">終了日<input type="date" value={to} onInput={event => setTo(event.currentTarget.value)} onChange={event => setTo(event.target.value)} className={field} /></label><label className="text-sm">試合時の学年<select value={grade} onChange={event => setGrade(event.target.value)} className={field}><option value="">すべての学年</option>{grades.map(item => <option key={item}>{item}</option>)}</select></label></div>
    </div>
    {invalid ? <p role="alert" className="text-action">終了日は開始日以降にしてください。</p> : <>
      <div className="flex items-baseline justify-between"><h2 className="font-bold">{from || to || grade ? "絞り込み結果" : "通算成績"}</h2><span className="text-sm text-muted">{stats.games}試合 · 暫定記録を含む</span></div>
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">{[["打率", stats.average], ["打席", stats.plateAppearances], ["打数", stats.atBats], ["安打", stats.hits], ["本塁打", stats.homeRuns], ["打点", stats.rbi], ["得点", stats.runs]].map(([label, value]) => <div key={label} className="rounded-card border border-line bg-surface p-4"><dt className="text-xs font-bold text-muted">{label}</dt><dd className={`mt-1 text-3xl font-bold tabular-nums ${label === "打率" ? "text-primary-dark" : "text-ink"}`}>{value}</dd></div>)}</dl>
      <p className="text-xs text-muted">打率＝安打合計÷打数合計。四球・死球・申告敬遠・犠打は打数に含めません。打数0は「—」です。</p>
      {stats.undated > 0 ? <p className="rounded-control bg-primary-soft p-3 text-sm">日付未設定の試合が{stats.undated}件あります。{from || to ? "今回の期間集計には含めていません。" : "通算には含みますが、期間指定時は除外します。"}試合別の内訳から日付を設定できます。</p> : null}
      <h2 className="font-bold">学年別の成績{from || to ? "（指定期間内）" : ""}</h2>
      <div className="overflow-x-auto rounded-card border border-line bg-surface"><table className="w-full text-right text-sm"><thead className="bg-primary-soft"><tr>{["学年", "試合", "打率", "打席", "打数", "安打", "本塁打", "打点", "得点"].map(label => <th key={label} className="whitespace-nowrap p-3">{label}</th>)}</tr></thead><tbody>{grades.filter(item => !grade || item === grade).map(item => { const row = memberStats(book.matches, member.id, { from, to, grade: item }); return <tr key={item} className="border-t border-line"><th className="whitespace-nowrap p-3">{item}</th>{[row.games, row.average, row.plateAppearances, row.atBats, row.hits, row.homeRuns, row.rbi, row.runs].map((value, index) => <td key={index} className="p-3 tabular-nums">{value}</td>)}</tr>; })}</tbody></table></div>
      <h2 className="font-bold">試合別の内訳</h2>
      {!stats.rows.length ? <p className="rounded-card border border-dashed border-line p-6 text-center text-muted">この条件に一致する出場記録はありません。</p> : <div className="space-y-2">{stats.rows.map(row => <button key={row.match.id} type="button" disabled={disabled} onClick={() => openMatch(row.match.id)} className="flex min-h-20 w-full flex-wrap items-center justify-between gap-2 rounded-card border border-line bg-surface p-4 text-left hover:border-primary"><span><span className="block text-xs text-muted">{row.match.date ?? "日付未設定"} · {row.match.players.find(player => player.id === member.id)?.grade}</span><strong>{row.match.teams.away.name} vs {row.match.teams.home.name}</strong><span className="mt-1 block text-sm">{row.atBats}打数 {row.hits}安打 · 打率 {average(row.hits, row.atBats)} · {row.rbi}打点</span></span><span className="text-sm font-bold text-primary">スコアを見る →</span></button>)}</div>}
    </>}
    {!readOnly ? <details className="rounded-card border border-line bg-surface p-4"><summary className="cursor-pointer font-bold">メンバー情報を編集</summary><MemberForm book={book} member={member} disabled={disabled} save={async next => save({ ...book, members: book.members.map(item => item.id === member.id ? next : item) })} /></details> : null}
  </section>;
}
