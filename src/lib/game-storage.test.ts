import { describe, expect, it } from "vitest";
import { applyPlayEvent, undoLastPlay } from "./game-engine";
import { decodeGame, encodeGame, GAME_STORAGE_KEY, saveGame } from "./game-storage";
import { getCurrentLineupSlot, initialGameState } from "./score-data";
import { isRunnerResult, resolveMovements, suggestedMovements } from "./play-resolution";
import { buildPlayNotation } from "./play-details";
import { buildCellRecord, buildPlayerSummary } from "./paper-score";
import type { GameState, PlateAppearanceResult, PlayDetails, RunnerMovement } from "./types";

function record(game: GameState, result: PlateAppearanceResult, edits: Partial<RunnerMovement>[] = [], details: PlayDetails = {}) {
  const batterId = getCurrentLineupSlot(game).playerId;
  const movements = suggestedMovements(game, batterId, result).map((move, i) => ({ ...move, ...edits[i] }));
  const resolved = resolveMovements(game, batterId, result, movements, "tag", details);
  if (resolved.error !== null) throw new Error(resolved.error);
  return applyPlayEvent(game, {
    ...details, ...resolved.transition, id: String(game.events.length), inning: game.inning, half: game.half,
    batterId, result, notation: buildPlayNotation(result, details), scoringStatus: "provisional",
    kind: isRunnerResult(result) ? "runner" : "plate", movements: resolved.movements, thirdOutKind: resolved.thirdOutKind
  });
}

function memoryStorage(initial: string | null = null) {
  let raw = initial;
  return { getItem: () => raw, setItem: (_key: string, value: string) => { raw = value; } };
}

describe("記録の保存と復元", () => {
  it("未保存は初期状態、記録済みは打順・得点・塁と紙スコアを復元する", () => {
    expect(decodeGame(null)).toEqual(initialGameState);
    let game = record(initialGameState, "single", [], { direction: 7 });
    game = record(game, "stolen_base", [{ to: "second" }]);
    game = record(game, "home_run", [], { direction: 8 });
    const restored = decodeGame(encodeGame(game));
    expect(restored).toEqual(game);
    expect(restored.awayScore).toBe(2);
    expect(buildCellRecord(restored.events, 0)).toEqual(buildCellRecord(game.events, 0));
    expect(buildPlayerSummary(restored.events, "p1")).toEqual({ atBats: 1, hits: 1, rbi: 0, runs: 1 });
    const undone = undoLastPlay(restored, initialGameState);
    expect(decodeGame(encodeGame(undone))).toEqual(undone);
    expect(undone.bases.second).toBe("p1");
    expect(undone.battingOrderIndex.top).toBe(1);
  });
  it("チェンジ後の両チームの打順と取消を復元する", () => {
    let game = record(initialGameState, "strikeout");
    game = record(game, "strikeout");
    game = record(game, "strikeout");
    game = record(game, "double", [], { direction: 9 });
    const restored = decodeGame(encodeGame(game));
    expect(restored.half).toBe("bottom");
    expect(restored.battingOrderIndex).toEqual({ top: 3, bottom: 1 });
    expect(restored.bases.second).toBe("home-p1");
    const beforeChange = undoLastPlay(undoLastPlay(restored, initialGameState), initialGameState);
    expect(beforeChange.half).toBe("top");
    expect(beforeChange.outs).toBe(2);
  });
  it("全取消した空の記録を保存しても古いイベントが復活しない", () => {
    const game = record(initialGameState, "walk");
    const storage = memoryStorage();
    const previous = saveGame(storage, null, game);
    saveGame(storage, previous, undoLastPlay(game, initialGameState));
    expect(decodeGame(storage.getItem())).toEqual(initialGameState);
  });
  it("旧形式の進塁情報なしイベントも保存された結果で復元する", () => {
    const game = record(initialGameState, "single", [], { direction: 7 });
    const legacy = { ...game, events: game.events.map(({ movements: _movements, kind: _kind, ...event }) => { void _movements; void _kind; return event; }) };
    expect(decodeGame(encodeGame(legacy)).events).toEqual(legacy.events);
  });
  it.each(["{", "null", '{"version":2,"events":[]}', '{"version":1,"events":[null]}'])("不正な保存データを初期状態として黙って扱わない: %s", raw => {
    expect(() => decodeGame(raw)).toThrow("上書きしていません");
  });
  it("未知の選手・結果、イベント順や集計の不整合を拒否する", () => {
    const game = record(initialGameState, "single", [], { direction: 7 });
    for (const patch of [{ batterId: "unknown" }, { result: "constructor" }, { inning: 2 }, { runsScored: ["p1"] }, { outsAdded: 2 }, { movements: [{ from: "batter", playerId: "p1", to: "invalid" }] }]) {
      const data = JSON.parse(encodeGame(game));
      Object.assign(data.events[0], patch);
      expect(() => decodeGame(JSON.stringify(data))).toThrow();
    }
  });
  it("別のタブによる更新を上書きしない", () => {
    const storage = memoryStorage();
    const game = record(initialGameState, "single");
    const newest = saveGame(storage, null, game);
    expect(() => saveGame(storage, null, initialGameState)).toThrow("別の画面");
    expect(storage.getItem()).toBe(newest);
  });
  it("容量不足を成功扱いせず、既存の記録を残す", () => {
    const previous = encodeGame(record(initialGameState, "walk"));
    const storage = { getItem: () => previous, setItem: () => { throw new Error("QuotaExceededError"); } };
    expect(() => saveGame(storage, previous, initialGameState)).toThrow("QuotaExceededError");
    expect(storage.getItem()).toBe(previous);
    expect(GAME_STORAGE_KEY).toContain("v1");
  });
});
