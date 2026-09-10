import { describe, expect, it } from "vitest";
import { applyPlayEvent, undoLastPlay } from "./game-engine";
import { buildCellRecord, buildPlayerSummary, findPlateAppearances } from "./paper-score";
import { buildPlayNotation } from "./play-details";
import { isRunnerResult, resolveMovements, suggestedMovements } from "./play-resolution";
import { initialGameState } from "./score-data";
import { paperSymbol } from "./paper-symbol";
import type { GameState, PlateAppearanceResult, PlayDetails, RunnerMovement, ThirdOutKind } from "./types";

function record(game: GameState, result: PlateAppearanceResult, changes: Partial<RunnerMovement>[] = [], details: PlayDetails = {}, third: ThirdOutKind | "" = "", batter = "p2") {
  const moves = suggestedMovements(game, batter, result).map((move, i) => ({ ...move, ...changes[i] }));
  const resolved = resolveMovements(game, batter, result, moves, third, details);
  if (resolved.error !== null) throw new Error(resolved.error);
  return applyPlayEvent(game, {
    ...resolved.transition, ...details, id: String(game.events.length), inning: game.inning, half: game.half,
    batterId: batter, result, notation: buildPlayNotation(result, details),
    movements: resolved.movements, kind: isRunnerResult(result) ? "runner" : "plate",
    thirdOutKind: resolved.thirdOutKind, scoringStatus: "provisional"
  });
}
const onFirst = () => record(initialGameState, "single", [], { direction: 7 }, "", "p1");

describe("走塁と投手のイベント", () => {
  it.each(["stolen_base", "wild_pitch", "passed_ball", "runner_error"] as const)("%sは打順を進めず既存打席に追記し、取消で戻る", result => {
    const before = onFirst();
    const after = record(before, result, [{ to: "second" }], result === "runner_error" ? { fieldingSequence: [2, 6] } : {});
    expect(after.battingOrderIndex).toEqual(before.battingOrderIndex);
    expect(after.bases.second).toBe("p1");
    expect(findPlateAppearances(after.events, "p2", 1)).toEqual([]);
    expect(buildCellRecord(after.events, 0).notes?.length).toBeGreaterThan(0);
    expect(buildPlayerSummary(after.events, "p2").atBats).toBe(0);
    expect(undoLastPlay(after, initialGameState)).toEqual(before);
  });
  it("ボークは全走者を1塁ずつ進めて打点を付けない", () => {
    const before = { ...onFirst(), bases: { first: "p1", second: "p3", third: "p4" } };
    const after = record(before, "balk");
    expect(after.bases).toEqual({ first: null, second: "p1", third: "p3" });
    expect(after.awayScore).toBe(1);
    expect(after.events.at(-1)?.rbi).toBe(0);
  });
  it.each(["caught_stealing", "tag_out", "rundown"] as const)("%sは対象走者だけアウト、元の打席にアウト順を付ける", result => {
    const before = onFirst();
    const after = record(before, result, [{ to: "out", outOrder: 1, outAt: "second" }], { fieldingSequence: [2, 6] });
    expect(after.outs).toBe(1);
    expect(after.bases.first).toBeNull();
    expect(after.battingOrderIndex).toEqual(before.battingOrderIndex);
    const cell = buildCellRecord(after.events, 0);
    expect(cell.outNumber).toBe(1);
    expect(cell.leftOnBase).toBe(false);
  });
  it("盗塁死が3アウト目ならチェンジし、取消で走者・打順を戻す", () => {
    let before = onFirst();
    before = record(before, "strikeout", [], {}, "", "p2");
    before = record(before, "strikeout", [], {}, "", "p3");
    const after = record(before, "caught_stealing", [{ to: "out", outOrder: 1 }], { fieldingSequence: [2, 6] }, "tag");
    expect(after.half).toBe("bottom");
    expect(after.battingOrderIndex.top).toBe(3);
    expect(buildCellRecord(after.events, 0).outNumber).toBe(3);
    expect(undoLastPlay(after, initialGameState)).toEqual(before);
  });
});

describe("追加の打席結果", () => {
  it.each(["infield_hit", "bunt_hit", "intentional_walk", "dropped_third", "fielders_choice"] as const)("%sを打席として記録する", result => {
    const after = record(initialGameState, result, [], { direction: 5, fieldingSequence: [6, 4] }, "", "p1");
    expect(after.battingOrderIndex.top).toBe(1);
    expect(after.bases.first).toBe("p1");
    const stats = buildPlayerSummary(after.events, "p1");
    expect(stats.hits).toBe(["infield_hit", "bunt_hit"].includes(result) ? 1 : 0);
    expect(stats.atBats).toBe(result === "intentional_walk" ? 0 : 1);
  });
  it.each(["foul_fly", "lineout"] as const)("%sは打者アウトになり対応する図形を返す", result => {
    const after = record(initialGameState, result, [], { direction: 5 }, "", "p1");
    expect(after.outs).toBe(1);
    const symbol = paperSymbol(after.events[0]);
    expect(result === "foul_fly" ? symbol.fly : symbol.liner).toBe(true);
  });
  it("併殺は2人の元のマスへ別々のアウト順を付ける", () => {
    const before = onFirst();
    const after = record(before, "double_play", [{ to: "out", outOrder: 1 }, { to: "out", outOrder: 2 }], { fieldingSequence: [6, 4, 3] });
    expect(after.outs).toBe(2);
    expect(after.bases).toEqual({ first: null, second: null, third: null });
    expect(buildCellRecord(after.events, 0).outNumber).toBe(1);
    expect(buildCellRecord(after.events, 0).notes).toEqual([{ text: "DP 6-4-3", base: 2 }]);
    expect(buildCellRecord(after.events, 1).outNumber).toBe(2);
    expect(after.events[1].rbi).toBe(0);
    expect(undoLastPlay(after, initialGameState)).toEqual(before);
  });
  it("ワンヒットワンエラーでは安打の到達塁と失策後の到達塁を分ける", () => {
    const after = record(initialGameState, "hit_error", [{ to: "second", via: "first" }], { direction: 7, errorFielder: 8 }, "", "p1");
    expect(paperSymbol(after.events[0]).hitBases).toBe(1);
    expect(buildCellRecord(after.events, 0).reached).toBe(2);
    expect(buildCellRecord(after.events, 0).notes?.[0].text).toBe("8E");
    expect(buildPlayerSummary(after.events, "p1").hits).toBe(1);
  });
});

describe("誤入力と第3アウトの得点", () => {
  it("一塁占有時の振り逃げを2アウト未満では拒否する", () => {
    const before = onFirst();
    expect(() => record(before, "dropped_third")).toThrow("振り逃げ");
  });
  it("走者なしの盗塁、同じ塁への重複、併殺の1アウト指定を拒否する", () => {
    expect(() => record(initialGameState, "stolen_base")).toThrow("走者");
    expect(() => record(onFirst(), "single", [{ to: "first" }])).toThrow("同じ塁");
    expect(() => record(onFirst(), "double_play", [], { fieldingSequence: [6, 4, 3] })).toThrow("2人");
  });
  it("2アウトからの併殺を拒否する", () => {
    const before = { ...onFirst(), outs: 2 };
    expect(() => record(before, "double_play", [{ to: "out", outOrder: 1 }, { to: "out", outOrder: 2 }], { fieldingSequence: [6, 4, 3] })).toThrow("3を超え");
  });
  it("フォースアウト・打者一塁到達前の第3アウトでは得点しない", () => {
    const before = { ...initialGameState, outs: 2, bases: { first: null, second: null, third: "p1" } };
    const after = record(before, "groundout", [{ to: "home", scoredBeforeThirdOut: true }, { to: "out", outOrder: 1 }], { fieldingSequence: [5, 3] }, "tag");
    expect(after.awayScore).toBe(0);
    expect(after.events.at(-1)?.runsScored).toEqual([]);
  });
  it("タッチによる第3アウトは先に生還した走者のみ得点する", () => {
    const before: GameState = { ...initialGameState, outs: 2, bases: { first: "p1", second: null, third: "p3" } };
    const after = record(before, "tag_out", [{ to: "out", outOrder: 1 }, { to: "home", scoredBeforeThirdOut: true }], { fieldingSequence: [6, 4] }, "tag");
    expect(after.awayScore).toBe(1);
    const noRun = record(before, "tag_out", [{ to: "out", outOrder: 1 }, { to: "home", scoredBeforeThirdOut: false }], { fieldingSequence: [6, 4] }, "tag");
    expect(noRun.awayScore).toBe(0);
  });
  it("四死球で強制されない三塁走者を勝手に生還させない", () => {
    const before: GameState = { ...initialGameState, bases: { first: null, second: null, third: "p3" } };
    const after = record(before, "intentional_walk");
    expect(after.awayScore).toBe(0);
    expect(after.bases.third).toBe("p3");
    expect(after.bases.first).toBe("p2");
  });
});


describe("失策と長い処理順の保存", () => {
  it("安打と失策を分け、他の走者に失策進塁を推測で付けない", () => {
    const after = record(onFirst(), "hit_error", [{ to: "third" }, { to: "second", via: "first" }], { direction: 7, errorFielder: 7 });
    expect(buildCellRecord(after.events, 0).notes).toBeUndefined();
    expect(buildCellRecord(after.events, 1).notes).toEqual([{ text: "7E", base: 2 }]);
  });
  it("挟殺で5人以上の送球順を省略しない", () => {
    const after = record(onFirst(), "rundown", [{ to: "out", outOrder: 1, outAt: "second" }], { fieldingSequence: [2, 6, 3, 4, 3, 6] });
    expect(after.events.at(-1)?.notation).toBe("R/O 2-6-3-4-3-6");
    expect(buildCellRecord(after.events, 0).notes?.[0].text).toBe("R/O 2-6-3-4-3-6");
  });
});

describe("得点と走者順の補強", () => {
  it.each(["flyout", "foul_fly", "lineout"] as const)("%sの捕球が第3アウトなら先の生還を指定しても得点しない", result => {
    const before: GameState = { ...initialGameState, outs: 2, bases: { first: null, second: null, third: "p1" } };
    const after = record(before, result, [{ to: "home", scoredBeforeThirdOut: true }, { to: "out", outOrder: 1 }], { direction: 8 }, "tag");
    expect(after.awayScore).toBe(0);
    expect(after.events.at(-1)?.thirdOutKind).toBe("caught_fly");
  });
  it("打者が一塁走者を追い越して三塁へ進む指定を拒否する", () => {
    expect(() => record(onFirst(), "single", [{ to: "second" }, { to: "third" }])).toThrow("追い越す");
  });
});
