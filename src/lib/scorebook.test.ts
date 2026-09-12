import { describe, expect, it } from "vitest";
import { applyPlayEvent, undoLastPlay } from "./game-engine";
import { encodeGame, GAME_STORAGE_KEY } from "./game-storage";
import { initialGameState, getCurrentLineupSlot } from "./score-data";
import { buildPlayNotation } from "./play-details";
import { isRunnerResult, resolveMovements, suggestedMovements } from "./play-resolution";
import { saveBook, BOOK_KEY, average, createBook, createMatch, decodeBook, encodeBook, gradeAt, isDate, memberStats, schoolYear, type Match, type Member } from "./scorebook";
import type { PlateAppearanceResult, RunnerMovement } from "./types";

function play(match: Match, result: PlateAppearanceResult, changes: Partial<RunnerMovement>[] = []): Match {
  const game = match.game;
  const batterId = getCurrentLineupSlot(game, match.lineups).playerId;
  const moves = suggestedMovements(game, batterId, result).map((move, i) => ({ ...move, ...changes[i] }));
  const resolved = resolveMovements(game, batterId, result, moves, "tag", { fieldingSequence: [5, 3] });
  if (resolved.error !== null) throw new Error(resolved.error);
  return { ...match, game: applyPlayEvent(game, {
    id: String(game.events.length), inning: game.inning, half: game.half, batterId, result,
    notation: buildPlayNotation(result, { fieldingSequence: [5, 3] }), fieldingSequence: [5, 3],
    ...resolved.transition, movements: resolved.movements, thirdOutKind: resolved.thirdOutKind,
    kind: isRunnerResult(result) ? "runner" : "plate", scoringStatus: "provisional"
  }) };
}
const book = createBook(null, "2026-09-10");
const selection = { top: book.members.filter(m => m.team === "top").map(m => m.id), bottom: book.members.filter(m => m.team === "bottom").map(m => m.id) };
const match = (id: string, date = "2026-09-10") => createMatch(book, id, date, "先攻", "後攻", selection);

describe("メンバーと試合の保存", () => {
  it("旧保存を日付を捏造せず移行し、プレー・取消を維持する", () => {
    const legacy = play(book.matches[0], "single").game;
    const migrated = createBook(encodeGame(legacy), "2026-09-10");
    expect(migrated.matches[0].date).toBeNull();
    const restored = decodeBook(encodeBook(migrated));
    expect(restored).toEqual(migrated);
    expect(undoLastPlay(restored.matches[0].game, initialGameState)).toEqual(initialGameState);
  });
  it("新規メンバーを打順に入れて記録・再読み込みできる", () => {
    const member: Member = { ...book.members[0], id: "new-player", name: "新規 太郎", grade: "4年" };
    const updated = { ...book, members: [...book.members, member] };
    const first = play(createMatch(updated, "new-match", "2026-09-10", "A", "B", { ...selection, top: [member.id, ...selection.top.slice(1)] }), "double");
    const saved = { ...updated, activeId: first.id, matches: [...updated.matches, first] };
    const restored = decodeBook(encodeBook(saved));
    expect(restored.matches[1].game.bases.second).toBe(member.id);
    expect(memberStats(restored.matches, member.id).hits).toBe(1);
  });
  it("メンバーの名前・学年を編集しても過去の試合を変更しない", () => {
    const first = play(match("first"), "single");
    const changed = { ...book, members: book.members.map(m => m.id === "p1" ? { ...m, name: "変更後", grade: "5年" } : m), matches: [first], activeId: first.id };
    const restored = decodeBook(encodeBook(changed));
    expect(restored.members[0].name).toBe("変更後");
    expect(restored.matches[0].players[0].name).toBe("佐藤 湊");
    expect(restored.matches[0].players[0].grade).toBe("6年");
  });
  it("打順の重複・他チームの選手・不正日付を拒否する", () => {
    expect(() => createMatch(book, "x", "2026-02-30", "A", "B", selection)).toThrow();
    expect(() => createMatch(book, "x", "2026-09-10", "A", "B", { ...selection, top: selection.top.map(() => "p1") })).toThrow();
    expect(() => createMatch(book, "x", "2026-09-10", "A", "B", { ...selection, top: selection.bottom })).toThrow();
  });
  it("保存済み試合の参照切れや破損を黙って初期化しない", () => {
    for (const mutate of [(data: Record<string, unknown>) => { data.activeId = "missing"; }, (data: Record<string, unknown>) => { data.members = []; }, (data: Record<string, unknown>) => { data.matches = []; }]) {
      const data = JSON.parse(encodeBook(book)); mutate(data);
      expect(() => decodeBook(JSON.stringify(data))).toThrow();
    }
    expect(() => decodeBook("{invalid")).toThrow();
  });
});

describe("日付・年度と学年", () => {
  it("4月1日の進級を反映する", () => {
    const member = { ...book.members[0], grade: "4年", gradeYear: 2025 };
    expect(schoolYear("2026-03-31")).toBe(2025);
    expect(gradeAt(member, "2026-03-31")).toBe("4年");
    expect(gradeAt(member, "2026-04-01")).toBe("5年");
    expect(gradeAt(member, "2028-04-01")).toBe("学年不明");
  });
  it("うるう年と不正な日付を区別する", () => {
    expect(isDate("2024-02-29")).toBe(true);
    expect(isDate("2025-02-29")).toBe(false);
    expect(isDate("2026-13-01")).toBe(false);
  });
});

describe("通算・学年別・期間の成績", () => {
  it("試合の打率の平均ではなく安打と打数を合算する", () => {
    const first = play(match("one", "2025-09-10"), "single");
    let second = match("two");
    // 一巡して2打席、どちらも失策出塁（打数には含む）。
    for (let i = 0; i < 10; i++) second = play(second, i === 0 || i === 9 ? "error" : "walk");
    const stats = memberStats([first, second], "p1");
    expect(stats.atBats).toBe(3); expect(stats.hits).toBe(1); expect(stats.average).toBe(".333");
    expect(memberStats([first, second], "p1", { grade: "5年" }).average).toBe("1.000");
    expect(memberStats([first, second], "p1", { from: "2026-09-10", to: "2026-09-10" }).atBats).toBe(2);
    expect(memberStats([first, second], "p1", { from: "2026-09-11" }).games).toBe(0);
  });
  it("日付不明は通算のみ含み、期間指定から除外する", () => {
    const unknown = play(book.matches[0], "single");
    expect(memberStats([unknown], "p1").hits).toBe(1);
    const filtered = memberStats([unknown], "p1", { to: "2026-12-31" });
    expect(filtered.hits).toBe(0); expect(filtered.undated).toBe(1);
  });
  it("四死球・犠打は打席のみ、失策・野選は打数に含む", () => {
    for (const result of ["walk", "hit_by_pitch", "intentional_walk", "sacrifice", "error", "fielders_choice"] as const) {
      const stats = memberStats([play(match(result), result)], "p1");
      expect(stats.plateAppearances).toBe(1);
      expect(stats.atBats).toBe(["error", "fielders_choice"].includes(result) ? 1 : 0);
      expect(stats.hits).toBe(0);
    }
    expect(average(0, 0)).toBe("—");
  });
  it("走塁で現在打者の出場試合・打席を増やさない", () => {
    const scored = play(play(match("steal"), "single"), "stolen_base", [{ to: "second" }]);
    expect(memberStats([scored], "p2").games).toBe(0);
    expect(memberStats([scored], "p1").plateAppearances).toBe(1);
  });
  it("本塁打・打点・得点を合算し、取消を反映する", () => {
    const scored = play(match("hr"), "home_run");
    expect(memberStats([scored], "p1")).toMatchObject({ hits: 1, homeRuns: 1, rbi: 1, runs: 1 });
    expect(memberStats([{ ...scored, game: undoLastPlay(scored.game, initialGameState) }], "p1").games).toBe(0);
  });
});


describe("試合帳の保存失敗と競合", () => {
  it("バックアップの復元後も複数試合・成績・旧保存を維持する", () => {
    const first = play(match("backup-one", "2025-09-10"), "single");
    const second = play(match("backup-two"), "home_run");
    const imported = decodeBook(encodeBook({ ...book, matches: [first, second], activeId: second.id }));
    const original = encodeBook(book);
    const legacy = encodeGame(initialGameState);
    const data = new Map([[BOOK_KEY, original], [GAME_STORAGE_KEY, legacy]]);
    const storage = { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => { data.set(key, value); } };
    saveBook(storage, original, legacy, imported);
    const reloaded = decodeBook(storage.getItem(BOOK_KEY)!);
    expect(reloaded).toEqual(imported);
    expect(memberStats(reloaded.matches, "p1")).toMatchObject({ games: 2, hits: 2, homeRuns: 1, average: "1.000" });
    expect(storage.getItem(GAME_STORAGE_KEY)).toBe(legacy);
  });
  it("プレビュー中に別の保存が入ったら復元で上書きしない", () => {
    const original = encodeBook(book);
    const updated = { ...book, matches: [play(book.matches[0], "single")] };
    const latest = encodeBook(updated);
    const data = new Map([[BOOK_KEY, latest]]);
    const storage = { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => { data.set(key, value); } };
    expect(() => saveBook(storage, original, null, decodeBook(original))).toThrow("別の画面");
    expect(storage.getItem(BOOK_KEY)).toBe(latest);
  });
  it("旧データを残したまま新形式を保存する", () => {
    const legacy = encodeGame(initialGameState);
    const data = new Map([[GAME_STORAGE_KEY, legacy]]);
    const storage = { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => { data.set(key, value); } };
    saveBook(storage, null, legacy, book);
    expect(data.get(GAME_STORAGE_KEY)).toBe(legacy);
    expect(decodeBook(data.get(BOOK_KEY)!)).toEqual(book);
    expect(() => saveBook(storage, null, legacy, book)).toThrow("別の画面");
  });
  it("破損した試合を保存せず、容量不足も呼び出し側へ返す", () => {
    let writes = 0;
    const storage = { getItem: () => null, setItem: () => { writes++; throw new Error("容量不足"); } };
    expect(() => saveBook(storage, null, null, { ...book, activeId: "missing" })).toThrow();
    expect(writes).toBe(0);
    expect(() => saveBook(storage, null, null, book)).toThrow("容量不足");
    expect(writes).toBe(1);
  });
});
