import { decodeGame, GAME_STORAGE_KEY } from "./game-storage";
import { initialGameState, lineups, players, teams } from "./score-data";
import { buildPlayerSummary } from "./paper-score";
import type { GameState, Half, LineupChange, LineupSlot, Player } from "./types";
import { currentLineups, defaultSources } from "./lineup-changes";

export type Member = Player & { team: Half; gradeYear: number };
export type Match = {
  id: string;
  date: string | null;
  teams: { away: { name: string; short: string }; home: { name: string; short: string } };
  players: Player[];
  lineups: Record<Half, LineupSlot[]>;
  changes?: LineupChange[];
  teamSources?: Record<Half, Half>;
  game: GameState;
};
export type Scorebook = { version: 2; members: Member[]; matches: Match[]; activeId: string };
export const BOOK_KEY = "baseball-score-link:scorebook:v2";
export const BOOK_LOCK = `${BOOK_KEY}:write`;

export function localDate(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
export function schoolYear(date: string) { return Number(date.slice(0, 4)) - (Number(date.slice(5, 7)) < 4 ? 1 : 0); }
export function isDate(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number(value.slice(0, 4)) >= 1900 &&
    !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
}
export function gradeAt(member: Member, date: string) {
  const grade = Number.parseInt(member.grade) + schoolYear(date) - member.gradeYear;
  return grade >= 1 && grade <= 6 ? `${grade}年` : "学年不明";
}

export function createBook(legacyRaw: string | null, today = localDate()): Scorebook {
  const game = decodeGame(legacyRaw);
  return {
    version: 2,
    members: players.map(player => ({ ...player, team: player.id.startsWith("home-") ? "bottom" : "top", gradeYear: schoolYear(today) })),
    activeId: "legacy",
    matches: [{ id: "legacy", date: null, teams, players, lineups, game }]
  };
}

export function createMatch(book: Scorebook, id: string, date: string, away: string, home: string, selected: Record<Half, string[]>, teamSources: Record<Half, Half> = defaultSources): Match {
  if (!["top", "bottom"].includes(teamSources.top) || !["top", "bottom"].includes(teamSources.bottom) || teamSources.top === teamSources.bottom) throw new Error("両チームの所属を確認してください。");
  if (!isDate(date) || !away.trim() || !home.trim()) throw new Error("試合日と両チーム名を入力してください。");
  if (book.matches.some(match => match.id === id)) throw new Error("同じ試合IDは使えません。");
  const chosen = (["top", "bottom"] as const).flatMap(half => {
    const ids = selected[half];
    if (ids.length !== 9 || new Set(ids).size !== 9) throw new Error("各チームの打順に異なる9人を指定してください。");
    return ids.map(id => {
      const member = book.members.find(member => member.id === id && member.team === teamSources[half]);
      if (!member) throw new Error("登録済みのメンバーを選択してください。");
      return { ...member, grade: gradeAt(member, date) };
    });
  });
  const makeLineup = (start: number) => chosen.slice(start, start + 9).map((player, index) => ({ order: index + 1, playerId: player.id, position: player.position }));
  return {
    id, date, teams: { away: { name: away.trim(), short: away.trim() }, home: { name: home.trim(), short: home.trim() } },
    players: chosen, lineups: { top: makeLineup(0), bottom: makeLineup(9) }, teamSources, game: initialGameState
  };
}

export function swapMatchSides(match: Match): Match {
  if (match.game.events.length || match.changes?.length) throw new Error("記録開始後は先攻・後攻を入れ替えられません。新しい試合を作成してください。");
  const sources = match.teamSources ?? defaultSources;
  return { ...match, teams: { away: match.teams.home, home: match.teams.away },
    lineups: { top: match.lineups.bottom, bottom: match.lineups.top }, teamSources: { top: sources.bottom, bottom: sources.top } };
}

export function replayMatch(match: Match): Match {
  return { ...match, game: decodeGame(JSON.stringify({ version: 1, roster: match.players.map(player => player.id), events: match.game.events }), match.players, match.lineups, match.changes ?? []) };
}

export function substitute(book: Scorebook, match: Match, team: Half, order: number, incomingId: string, kind: LineupChange["kind"], position: string, id: string): Match {
  const slot = currentLineups(match)[team][order - 1];
  const member = book.members.find(member => member.id === incomingId && member.team === (match.teamSources ?? defaultSources)[team]);
  if (!slot || (!member && kind !== "position")) throw new Error("このチームの登録メンバーを選択してください。");
  const changes = [...(match.changes ?? []), { id, beforePlay: match.game.events.length, team, order, incomingId, outgoingId: slot.playerId, kind, position }];
  const snapshots = match.players.some(player => player.id === incomingId) ? match.players :
    [...match.players, { ...member!, grade: match.date ? gradeAt(member!, match.date) : "学年不明" }];
  return replayMatch({ ...match, players: snapshots, changes });
}

// 交代とプレーの時系列を保ち、最後に行った操作を1件だけ取り消す。
export function undoMatch(match: Match): Match {
  const changes = match.changes ?? [];
  if (changes.at(-1)?.beforePlay === match.game.events.length) {
    const remaining = changes.slice(0, -1);
    const used = new Set([...Object.values(match.lineups).flat().map(slot => slot.playerId), ...remaining.map(change => change.incomingId)]);
    return replayMatch({ ...match, players: match.players.filter(player => used.has(player.id)), changes: remaining });
  }
  if (!match.game.events.length) return match;
  return replayMatch({ ...match, game: { ...match.game, events: match.game.events.slice(0, -1) } });
}

// 保存の境界で形を検証する。既存イベントの復元は共通ロジックを使う。
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);
function isPlayer(value: unknown): value is Player {
  return object(value) && typeof value.id === "string" && value.id.length > 0 && typeof value.name === "string" && !!value.name.trim() &&
    Number.isInteger(value.number) && Number(value.number) >= 0 && Number(value.number) <= 999 && typeof value.grade === "string" &&
    /^(?:[1-6]年|学年不明)$/.test(value.grade) && typeof value.position === "string" &&
    ["右", "左", "両"].includes(String(value.bats)) && ["右", "左"].includes(String(value.throws));
}
export function encodeBook(book: Scorebook) {
  return JSON.stringify({ ...book, matches: book.matches.map(({ game, ...match }) => ({ ...match, events: game.events })) });
}
export function decodeBook(raw: string): Scorebook {
  const fail = () => new Error("保存済みの試合・メンバーを読み込めません。元のデータは上書きしていません。");
  let data: unknown;
  try { data = JSON.parse(raw); } catch { throw fail(); }
  if (!object(data) || data.version !== 2 || !Array.isArray(data.members) || !Array.isArray(data.matches) || !data.matches.length) throw fail();
  const members: Member[] = [];
  for (const member of data.members) {
    if (!object(member) || !["top", "bottom"].includes(String(member.team)) || !Number.isInteger(member.gradeYear) || Number(member.gradeYear) < 1900 || !isPlayer(member)) throw fail();
    members.push(member as Member);
  }
  if (new Set(members.map(member => member.id)).size !== members.length) throw fail();
  const matches: Match[] = [];
  for (const item of data.matches) {
    if (!object(item) || typeof item.id !== "string" || !item.id || (item.date !== null && !isDate(item.date)) || !Array.isArray(item.players) ||
      !item.players.every(isPlayer) || new Set(item.players.map(player => player.id)).size !== item.players.length ||
      item.players.some(player => !members.some(member => member.id === player.id)) || !object(item.lineups) || !object(item.teams)) throw fail();
    for (const key of ["away", "home"]) {
      const team = item.teams[key];
      if (!object(team) || typeof team.name !== "string" || !team.name.trim() || typeof team.short !== "string") throw fail();
    }
    const snapshots = item.players;
    const allIds: string[] = [];
    for (const half of ["top", "bottom"]) {
      const lineup = item.lineups[half];
      if (!Array.isArray(lineup) || lineup.length !== 9 || lineup.some((slot, index) => !object(slot) || slot.order !== index + 1 ||
        !snapshots.some((player: Player) => player.id === slot.playerId) || typeof slot.position !== "string")) throw fail();
      allIds.push(...lineup.map(slot => slot.playerId));
    }
    if (new Set(allIds).size !== 18) throw fail();
    if (item.changes !== undefined && !Array.isArray(item.changes)) throw fail();
    if (item.teamSources !== undefined && (!object(item.teamSources) ||
      !["top", "bottom"].includes(String(item.teamSources.top)) || !["top", "bottom"].includes(String(item.teamSources.bottom)) || item.teamSources.top === item.teamSources.bottom)) throw fail();
    const match = item as unknown as Omit<Match, "game">;
    const game = decodeGame(JSON.stringify({ version: 1, roster: match.players.map(player => player.id), events: item.events }), match.players, match.lineups, match.changes ?? []);
    matches.push({ id: match.id, date: match.date, teams: match.teams, players: match.players, lineups: match.lineups, game,
      ...(match.changes ? { changes: match.changes } : {}), ...(match.teamSources ? { teamSources: match.teamSources } : {}) });
  }
  if (new Set(matches.map(match => match.id)).size !== matches.length || !matches.some(match => match.id === data.activeId)) throw fail();
  return { version: 2, members, matches, activeId: data.activeId as string };
}

export type StatsFilter = { from?: string; to?: string; grade?: string };
export function matchStats(match: Match, playerId: string) {
  const own = match.game.events.filter(event => event.kind !== "runner" && event.batterId === playerId);
  return { ...buildPlayerSummary(match.game.events, playerId), plateAppearances: own.length, homeRuns: own.filter(event => event.result === "home_run").length };
}
export function memberStats(matches: Match[], playerId: string, filter: StatsFilter = {}) {
  const eligible = matches.filter(match => match.players.some(player => player.id === playerId) && (match.changes?.some(change => change.incomingId === playerId) || match.game.events.some(event =>
    (event.kind !== "runner" && event.batterId === playerId) || event.movements?.some(move => move.playerId === playerId) || event.runsScored.includes(playerId))));
  const rows = eligible.filter(match => (!filter.grade || match.players.find(player => player.id === playerId)?.grade === filter.grade) &&
    (!(filter.from || filter.to) || !!match.date) && (!filter.from || match.date! >= filter.from) && (!filter.to || match.date! <= filter.to))
    .map(match => ({ match, ...matchStats(match, playerId) })).sort((a, b) => (b.match.date ?? "").localeCompare(a.match.date ?? ""));
  const total = rows.reduce((sum, row) => ({
    plateAppearances: sum.plateAppearances + row.plateAppearances, atBats: sum.atBats + row.atBats, hits: sum.hits + row.hits,
    homeRuns: sum.homeRuns + row.homeRuns, rbi: sum.rbi + row.rbi, runs: sum.runs + row.runs
  }), { plateAppearances: 0, atBats: 0, hits: 0, homeRuns: 0, rbi: 0, runs: 0 });
  return { ...total, games: rows.length, average: average(total.hits, total.atBats), rows,
    undated: eligible.filter(match => !match.date).length };
}
export function average(hits: number, atBats: number) { return atBats ? (hits / atBats).toFixed(3).replace(/^0\./, ".") : "—"; }


export function saveBook(storage: Pick<Storage, "getItem" | "setItem">, previousRaw: string | null, legacyRaw: string | null, book: Scorebook) {
  if (storage.getItem(BOOK_KEY) !== previousRaw || storage.getItem(GAME_STORAGE_KEY) !== legacyRaw) throw new Error("別の画面で記録が更新されました。再読み込みしてから続けてください。");
  const encoded = encodeBook(book);
  decodeBook(encoded);
  storage.setItem(BOOK_KEY, encoded);
  return encoded;
}
