import { describe, expect, it } from "vitest";
import { applyPlayEvent } from "./game-engine";
import { currentLineups, currentLineupState, paperLineupRows } from "./lineup-changes";
import { buildCellRecord } from "./paper-score";
import { resolveMovements, suggestedMovements } from "./play-resolution";
import { getCurrentLineupSlot } from "./score-data";
import { createBook, createMatch, decodeBook, encodeBook, endDH, memberStats, replayMatch, substitute, swapMatchSides, undoMatch, type Match } from "./scorebook";
import type { DHSetup, PlateAppearanceResult } from "./types";

const original = createBook(null, "2026-09-11");
const book = { ...original, members: [...original.members,
  { ...original.members[0], id: "pitcher-a", name: "先攻投手" },
  { ...original.members[0], id: "relief-a", name: "先攻控え" },
  { ...original.members[9], id: "pitcher-b", name: "後攻投手" },
  { ...original.members[9], id: "relief-b", name: "後攻控え" }
] };
const selected = { top: original.members.filter(m => m.team === "top").map(m => m.id), bottom: original.members.filter(m => m.team === "bottom").map(m => m.id) };
const setup: DHSetup = { top: { order: 1, pitcherId: "pitcher-a" }, bottom: { order: 1, pitcherId: "pitcher-b" } };
const fresh = (dh = setup) => createMatch(book, "dh-match", "2026-09-11", "先攻", "後攻", selected, undefined, dh);
const roundTrip = (m: Match) => decodeBook(encodeBook({ ...book, matches: [m], activeId: m.id })).matches[0];
function play(m: Match, result: PlateAppearanceResult) {
  const batterId = getCurrentLineupSlot(m.game, currentLineups(m)).playerId;
  const resolution = resolveMovements(m.game, batterId, result, suggestedMovements(m.game, batterId, result), "tag", { direction: 7 });
  if (resolution.error !== null) throw new Error(resolution.error);
  return { ...m, game: applyPlayEvent(m.game, { id: `play-${m.game.events.length}`, inning: m.game.inning, half: m.game.half,
    batterId, result, direction: 7, notation: "7", kind: "plate", ...resolution.transition, movements: resolution.movements,
    thirdOutKind: resolution.thirdOutKind, scoringStatus: "provisional" }) };
}

describe("DHの試合設定", () => {
  it("両チームを独立に設定でき、旧形式はDHなしのまま復元する", () => {
    for (const dh of [{}, { top: setup.top }, { bottom: setup.bottom }, setup]) {
      const m = roundTrip(fresh(dh));
      expect(currentLineupState(m).pitchers.top).toBe(dh.top?.pitcherId);
      expect(currentLineupState(m).pitchers.bottom).toBe(dh.bottom?.pitcherId);
      expect(m.lineups.top).toHaveLength(9);
      expect(m.lineups.bottom).toHaveLength(9);
      expect(m.players).toHaveLength(18 + Object.keys(dh).length);
    }
    expect(roundTrip(original.matches[0]).dh).toBeUndefined();
  });
  it("DHが4番でも野手8位置を維持し、投手は打席に入らない", () => {
    let m = fresh({ top: { order: 4, pitcherId: "pitcher-a" } });
    expect(m.lineups.top[3].position).toBe("DH");
    expect(m.lineups.top[0].position).toBe("二塁手");
    for (let i = 0; i < 9; i++) m = play(m, "home_run");
    expect(new Set(m.game.events.map(event => event.batterId))).toEqual(new Set(selected.top));
    expect(memberStats([m], "pitcher-a")).toMatchObject({ games: 1, atBats: 0, plateAppearances: 0 });
    expect(roundTrip(m).game).toEqual(m.game);
  });
  it("投手の重複・他チーム・不正な打順・守備の重複を拒否する", () => {
    for (const value of [{ order: 0, pitcherId: "pitcher-a" }, { order: 10, pitcherId: "pitcher-a" },
      { order: 1, pitcherId: "p1" }, { order: 1, pitcherId: "pitcher-b" }, { order: 1, pitcherId: "missing" }]) {
      expect(() => fresh({ top: value })).toThrow();
    }
    const bad = { ...book, members: book.members.map(member => member.id === "p2" ? { ...member, position: "投手" } : member) };
    expect(() => createMatch(bad, "bad", "2026-09-11", "A", "B", selected, undefined, setup)).toThrow();
  });
  it("先攻後攻の交換でDH設定と投手も交換する", () => {
    const m = fresh({ top: setup.top });
    const swapped = roundTrip(swapMatchSides(m));
    expect(swapped.dh).toEqual({ bottom: setup.top });
    expect(currentLineupState(swapped).pitchers.bottom).toBe("pitcher-a");
    expect(swapMatchSides(swapped)).toEqual(m);
  });
});

describe("DH継続と解除", () => {
  it("DHへの代打・代走に打席と得点を分けて付ける", () => {
    let m = play(fresh(), "single");
    m = substitute(book, m, "top", 1, "relief-a", "runner", "DH", "run");
    m = roundTrip(play(m, "home_run"));
    expect(currentLineupState(m).pitchers.top).toBe("pitcher-a");
    expect(currentLineups(m).top[0]).toMatchObject({ playerId: "relief-a", position: "DH" });
    expect(memberStats([m], "relief-a")).toMatchObject({ runs: 1, atBats: 0 });
    const ph = substitute(book, fresh(), "top", 1, "relief-a", "hitter", "DH", "hit");
    expect(currentLineups(roundTrip(play(ph, "single"))).top[0].position).toBe("DH");
  });
  it("投手交代はDHと打順を維持し、取消で投手を戻す", () => {
    const m = roundTrip(substitute(book, fresh(), "bottom", 0, "relief-b", "pitcher", "投手", "pitch"));
    expect(currentLineups(m)).toEqual(fresh().lineups);
    expect(currentLineupState(m).pitchers.bottom).toBe("relief-b");
    expect(m.game).toEqual(fresh().game);
    expect(memberStats([m], "relief-b")).toMatchObject({ games: 1, atBats: 0 });
    const undone = roundTrip(undoMatch(m));
    expect(currentLineupState(undone).pitchers.bottom).toBe("pitcher-b");
    expect(undone.players.some(player => player.id === "relief-b")).toBe(false);
    expect(undone.players.some(player => player.id === "pitcher-b")).toBe(true);
  });
  it("投手がDHの代走に入り、生還・取消・紙スコアも正しく追う", () => {
    const before = play(fresh(), "single");
    const changed = endDH(before, "top", "pitcher_bats", "投手", "end");
    expect(changed.game.bases.first).toBe("pitcher-a");
    const after = roundTrip(play(changed, "home_run"));
    expect(memberStats([after], "pitcher-a")).toMatchObject({ games: 1, runs: 1, atBats: 0 });
    expect(memberStats([after], "p1")).toMatchObject({ hits: 1, runs: 0 });
    expect(buildCellRecord(after.game.events, 0, after.changes)).toMatchObject({ reached: 4, notes: expect.arrayContaining([{ text: "代走", base: 1 }]) });
    expect(currentLineupState(after).pitchers.top).toBeUndefined();
    const back = roundTrip(undoMatch(undoMatch(after)));
    expect(back.game).toEqual(before.game);
    expect(currentLineupState(back).pitchers.top).toBe("pitcher-a");
  });
  it("投手がDHの代打になり、その後の打席を投手に集計する", () => {
    const m = roundTrip(play(endDH(fresh(), "top", "pitcher_bats", "投手", "end"), "single"));
    expect(memberStats([m], "pitcher-a")).toMatchObject({ hits: 1, atBats: 1, games: 1 });
    expect(currentLineups(m).top[0]).toMatchObject({ playerId: "pitcher-a", position: "投手" });
  });
  it("DHが捕手へ入ると投手は元の捕手の打順に入り、取消は配置を全て戻す", () => {
    const m = roundTrip(endDH(fresh(), "bottom", "dh_fields", "捕手", "end"));
    expect(currentLineups(m).bottom[0]).toMatchObject({ playerId: "home-p1", position: "捕手", order: 1 });
    expect(currentLineups(m).bottom[1]).toMatchObject({ playerId: "pitcher-b", position: "投手", order: 2 });
    expect(currentLineupState(undoMatch(m))).toEqual(currentLineupState(fresh()));
  });
  it("DHが投手になると打順を維持し、元の投手が退く", () => {
    const m = roundTrip(endDH(fresh(), "bottom", "dh_fields", "投手", "end"));
    expect(currentLineups(m).bottom[0]).toMatchObject({ playerId: "home-p1", position: "投手" });
    expect(currentLineupState(m).pitchers.bottom).toBeUndefined();
    expect(paperLineupRows(m, "bottom").find(row => row.playerId === "pitcher-b")?.order).toBe(0);
  });
  it("投手と捕手の交換でDHが退き、打順を崩さない", () => {
    const m = roundTrip(endDH(fresh(), "bottom", "pitcher_fields", "捕手", "end"));
    expect(currentLineups(m).bottom[0]).toMatchObject({ playerId: "pitcher-b", position: "捕手" });
    expect(currentLineups(m).bottom[1]).toMatchObject({ playerId: "home-p2", position: "投手" });
    expect(currentLineups(m).bottom.map(slot => slot.order)).toEqual([1,2,3,4,5,6,7,8,9]);
  });
  it("通常交代によるDH解除の迂回、再出場、DH再開、攻守違いを拒否する", () => {
    const m = fresh();
    expect(() => substitute(book, m, "bottom", 1, "home-p1", "position", "捕手", "bad")).toThrow();
    expect(() => substitute(book, m, "bottom", 2, "home-p2", "position", "投手", "bad")).toThrow();
    expect(() => substitute(book, m, "top", 0, "relief-a", "pitcher", "投手", "bad")).toThrow();
    expect(() => endDH(m, "top", "dh_fields", "捕手", "bad")).toThrow();
    expect(() => endDH(m, "bottom", "pitcher_bats", "投手", "bad")).toThrow();
    const ended = endDH(m, "bottom", "dh_fields", "捕手", "end");
    expect(() => endDH(ended, "bottom", "dh_fields", "捕手", "end2")).toThrow();
    expect(() => substitute(book, ended, "bottom", 2, "home-p2", "defense", "投手", "bad")).toThrow();
    expect(() => substitute(book, ended, "bottom", 1, "home-p1", "position", "DH", "bad")).toThrow();
  });
  it("紙スコアで投手を重複させず、打順外・打順内・交代を表示する", () => {
    const initialRows = paperLineupRows(fresh(), "bottom");
    expect(initialRows).toHaveLength(10);
    expect(initialRows.at(-1)).toMatchObject({ playerId: "pitcher-b", order: 0 });
    const changed = substitute(book, fresh(), "bottom", 0, "relief-b", "pitcher", "投手", "pitch");
    const ended = endDH(changed, "bottom", "dh_fields", "捕手", "end");
    const rows = paperLineupRows(ended, "bottom");
    expect(rows).toHaveLength(11);
    expect(new Set(rows.map(row => row.playerId)).size).toBe(11);
    expect(rows.find(row => row.playerId === "relief-b")).toMatchObject({ order: 2, position: "投手" });
    expect(rows.find(row => row.playerId === "home-p2")).toMatchObject({ order: 2, position: "捕手" });
  });
  it("不正なDH設定と解除履歴をバックアップ復元時に拒否する", () => {
    const m = fresh();
    for (const dh of [null, [], { top: null }, { top: { order: 1, pitcherId: "p2" } }, { top: { order: 2, pitcherId: "pitcher-a" } }, { extra: setup.top }]) {
      expect(() => roundTrip({ ...m, dh } as Match)).toThrow();
    }
    const ended = endDH(m, "bottom", "dh_fields", "捕手", "end");
    for (const patch of [{ dhEnd: "invalid" }, { incomingId: "p1" }, { position: "DH" }, { order: 0 }, { beforePlay: 2 }]) {
      expect(() => replayMatch({ ...ended, changes: [{ ...ended.changes![0], ...patch }] } as Match)).toThrow();
    }
  });
});
