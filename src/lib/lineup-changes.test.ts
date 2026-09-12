import { describe, expect, it } from "vitest";
import { applyPlayEvent } from "./game-engine";
import { currentLineups } from "./lineup-changes";
import { buildCellRecord } from "./paper-score";
import { buildPlayNotation } from "./play-details";
import { isRunnerResult, resolveMovements, suggestedMovements } from "./play-resolution";
import { getCurrentLineupSlot } from "./score-data";
import { createBook, createMatch, decodeBook, encodeBook, memberStats, replayMatch, substitute, swapMatchSides, undoMatch, type Match } from "./scorebook";
import type { PlateAppearanceResult } from "./types";

const initial = createBook(null, "2026-09-11");
const book = { ...initial, members: [...initial.members,
  { ...initial.members[0], id: "bench-a", name: "控え 太郎", grade: "4年" },
  { ...initial.members[0], id: "bench-b", name: "控え 次郎", grade: "5年" },
  { ...initial.members[9], id: "bench-home", name: "後攻 控え" }
] };
const selected = { top: initial.members.filter(m => m.team === "top").map(m => m.id), bottom: initial.members.filter(m => m.team === "bottom").map(m => m.id) };
const fresh = () => createMatch(book, "match", "2026-09-11", "先攻A", "後攻B", selected);
function play(match: Match, result: PlateAppearanceResult) {
  const batterId = getCurrentLineupSlot(match.game, currentLineups(match)).playerId;
  const resolution = resolveMovements(match.game, batterId, result, suggestedMovements(match.game, batterId, result), "tag", { direction: 7 });
  if (resolution.error) throw new Error(resolution.error);
  if (resolution.error !== null) throw new Error("進塁の解決に失敗");
  return { ...match, game: applyPlayEvent(match.game, { id: `play-${match.game.events.length}`, inning: match.game.inning, half: match.game.half,
    batterId, result, notation: buildPlayNotation(result, { direction: 7 }), direction: 7,
    kind: isRunnerResult(result) ? "runner" : "plate", ...resolution.transition, movements: resolution.movements,
    thirdOutKind: resolution.thirdOutKind, scoringStatus: "provisional" }) };
}
const roundTrip = (match: Match) => decodeBook(encodeBook({ ...book, matches: [match], activeId: match.id })).matches[0];

describe("交代履歴と復元", () => {
  it("代打に打席と安打を付け、先発の打席を増やさない", () => {
    let m = substitute(book, fresh(), "top", 1, "bench-a", "hitter", "投手", "sub-1");
    expect(m.game.battingOrderIndex.top).toBe(0);
    m = roundTrip(play(m, "single"));
    expect(m.game.bases.first).toBe("bench-a");
    expect(memberStats([m], "bench-a")).toMatchObject({ games: 1, hits: 1, atBats: 1 });
    expect(memberStats([m], "p1").plateAppearances).toBe(0);
    expect(currentLineups(m).top[0].playerId).toBe("bench-a");
  });
  it("代走が生還したら、元の打者は安打だけ、代走に得点を付ける", () => {
    let m = play(fresh(), "single");
    m = substitute(book, m, "top", 1, "bench-a", "runner", "投手", "sub-1");
    expect(m.game.bases.first).toBe("bench-a");
    expect(m.game.battingOrderIndex.top).toBe(1);
    m = roundTrip(play(m, "home_run"));
    expect(m.game.awayScore).toBe(2);
    expect(memberStats([m], "p1")).toMatchObject({ hits: 1, runs: 0 });
    expect(memberStats([m], "bench-a")).toMatchObject({ runs: 1, atBats: 0, plateAppearances: 0 });
    const cell = buildCellRecord(m.game.events, 0, m.changes);
    expect(cell.reached).toBe(4);
    expect(cell.notes).toContainEqual({ text: "代走", base: 1 });
  });
  it("プレー→代走→プレーを逆順に取り消し、塁上の元の選手まで戻す", () => {
    const before = play(fresh(), "single");
    const changed = substitute(book, before, "top", 1, "bench-a", "runner", "投手", "sub-1");
    const after = play(changed, "home_run");
    const oneBack = roundTrip(undoMatch(after));
    expect(oneBack.game).toEqual(changed.game);
    expect(oneBack.changes).toHaveLength(1);
    const twoBack = roundTrip(undoMatch(oneBack));
    expect(twoBack.game).toEqual(before.game);
    expect(currentLineups(twoBack).top[0].playerId).toBe("p1");
    expect(memberStats([twoBack], "bench-a").games).toBe(0);
    expect(twoBack.players).toEqual(before.players);
    expect(undoMatch(twoBack).game.events).toHaveLength(0);
  });
  it("同じタイミングの連続交代を保存し、一件ずつ取り消す", () => {
    const first = substitute(book, fresh(), "top", 1, "bench-a", "hitter", "投手", "sub-1");
    const second = substitute(book, first, "top", 1, "bench-b", "hitter", "投手", "sub-2");
    expect(currentLineups(roundTrip(second)).top[0].playerId).toBe("bench-b");
    expect(currentLineups(undoMatch(second)).top[0].playerId).toBe("bench-a");
  });
  it("守備交代で打順・アウト・得点を進めず、次の攻撃で交代選手が打つ", () => {
    let m = substitute(book, fresh(), "bottom", 1, "bench-home", "defense", "投手", "sub-1");
    expect(m.game).toEqual(fresh().game);
    expect(memberStats([m], "bench-home")).toMatchObject({ games: 1, atBats: 0 });
    for (let i = 0; i < 3; i++) m = play(m, "strikeout");
    m = roundTrip(play(m, "single"));
    expect(m.game.events.at(-1)?.batterId).toBe("bench-home");
    expect(m.game.half).toBe("bottom");
  });
  it("守備位置変更は選手間で位置を入れ替え、打順は変えない", () => {
    const m = substitute(book, fresh(), "bottom", 1, "home-p1", "position", "捕手", "pos-1");
    const lineup = currentLineups(roundTrip(m)).bottom;
    expect(lineup[0]).toMatchObject({ playerId: "home-p1", position: "捕手", order: 1 });
    expect(lineup[1].position).toBe("投手");
    expect(currentLineups(undoMatch(m))).toEqual(fresh().lineups);
  });
  it("再出場、相手チーム、別の打順への代打、走者なしの代走を拒否する", () => {
    const m = substitute(book, fresh(), "top", 1, "bench-a", "hitter", "投手", "sub-1");
    expect(() => substitute(book, m, "top", 1, "p1", "hitter", "投手", "sub-2")).toThrow();
    expect(() => substitute(book, fresh(), "top", 1, "bench-home", "hitter", "投手", "sub-1")).toThrow();
    expect(() => substitute(book, fresh(), "top", 2, "bench-a", "hitter", "捕手", "sub-1")).toThrow();
    expect(() => substitute(book, fresh(), "top", 1, "bench-a", "runner", "投手", "sub-1")).toThrow();
    expect(() => substitute(book, fresh(), "top", 1, "bench-a", "defense", "投手", "sub-1")).toThrow();
  });
  it("破損・未来・重複IDの交代履歴を拒否し、旧形式も復元できる", () => {
    expect(roundTrip(fresh())).toEqual(fresh());
    const m = substitute(book, fresh(), "top", 1, "bench-a", "hitter", "投手", "sub-1");
    for (const patch of [{ beforePlay: 9 }, { outgoingId: "p2" }, { kind: "invalid" }, { order: 10 }]) {
      expect(() => roundTrip({ ...m, changes: [{ ...m.changes![0], ...patch }] } as Match)).toThrow();
    }
    expect(() => replayMatch({ ...m, changes: [...m.changes!, m.changes![0]] })).toThrow();
  });
});

describe("先攻・後攻の入れ替え", () => {
  it("開始前だけチーム名・打順を交換し、所属・別試合を維持する", () => {
    const before = fresh();
    const m = roundTrip(swapMatchSides(before));
    expect(m.teams.away.name).toBe("後攻B");
    expect(m.lineups.top).toEqual(before.lineups.bottom);
    expect(m.teamSources).toEqual({ top: "bottom", bottom: "top" });
    expect(swapMatchSides(m)).toEqual(before);
    expect(book.members[0].team).toBe("top");
    expect(before.teams.away.name).toBe("先攻A");
    expect(() => swapMatchSides(play(m, "single"))).toThrow();
  });
  it("入れ替え後の控え候補と次の試合も所属を正しく引き継ぐ", () => {
    const m = swapMatchSides(fresh());
    const changed = substitute(book, m, "top", 1, "bench-home", "hitter", "投手", "sub-1");
    expect(currentLineups(roundTrip(changed)).top[0].playerId).toBe("bench-home");
    expect(() => swapMatchSides(changed)).toThrow();
    const next = createMatch(book, "next", "2026-09-12", m.teams.away.name, m.teams.home.name,
      { top: selected.bottom, bottom: selected.top }, m.teamSources);
    expect(roundTrip(next).lineups.top[0].playerId).toBe("home-p1");
  });
});
