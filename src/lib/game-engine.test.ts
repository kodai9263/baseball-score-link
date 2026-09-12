import { describe, expect, it } from "vitest";
import { advanceRunners, applyPlayEvent, buildScoreByInning, nextHalfInning, undoLastPlay } from "./game-engine";
import { buildInningLabels, getCurrentLineupSlot, initialGameState } from "./score-data";
import type { GameState, PlateAppearanceResult, PlayEvent, RunnerState } from "./types";

const bases = (first: string | null, second: string | null, third: string | null): RunnerState => ({
  first,
  second,
  third
});

const empty = bases(null, null, null);

const state = (overrides: Partial<GameState> = {}): GameState => ({ ...initialGameState, ...overrides });

describe("advanceRunners / 犠打", () => {
  it("走者がいなければ打者がアウトになるだけ", () => {
    const result = advanceRunners(state({ bases: empty }), "batter", "sacrifice");

    expect(result.outsAdded).toBe(1);
    expect(result.basesAfter).toEqual(empty);
    expect(result.runsScored).toEqual([]);
    expect(result.rbi).toBe(0);
  });

  it("一塁走者を二塁へ送る", () => {
    const result = advanceRunners(state({ bases: bases("r1", null, null) }), "batter", "sacrifice");

    expect(result.outsAdded).toBe(1);
    expect(result.basesAfter).toEqual(bases(null, "r1", null));
    expect(result.runsScored).toEqual([]);
  });

  it("一二塁の走者をそれぞれ1つ送る", () => {
    const result = advanceRunners(state({ bases: bases("r1", "r2", null) }), "batter", "sacrifice");

    expect(result.basesAfter).toEqual(bases(null, "r1", "r2"));
    expect(result.runsScored).toEqual([]);
  });

  it("三塁走者が生還し打点がつく（スクイズ）", () => {
    const result = advanceRunners(state({ bases: bases(null, null, "r3") }), "batter", "sacrifice");

    expect(result.runsScored).toEqual(["r3"]);
    expect(result.rbi).toBe(1);
    expect(result.basesAfter).toEqual(empty);
  });

  it("満塁では三塁走者が生還し、残りが1つずつ進む", () => {
    const result = advanceRunners(state({ bases: bases("r1", "r2", "r3") }), "batter", "sacrifice");

    expect(result.runsScored).toEqual(["r3"]);
    expect(result.rbi).toBe(1);
    expect(result.basesAfter).toEqual(bases(null, "r1", "r2"));
  });

  it("2アウトからの犠打は3アウト目になるため得点を認めない", () => {
    const result = advanceRunners(state({ outs: 2, bases: bases(null, null, "r3") }), "batter", "sacrifice");

    expect(result.outsAdded).toBe(1);
    expect(result.runsScored).toEqual([]);
    expect(result.rbi).toBe(0);
    expect(result.basesAfter).toEqual(bases(null, null, "r3"));
  });

  it("2アウトからの犠打では走者も進めない", () => {
    const result = advanceRunners(state({ outs: 2, bases: bases("r1", null, null) }), "batter", "sacrifice");

    expect(result.basesAfter).toEqual(bases("r1", null, null));
  });
});

describe("advanceRunners / 打者アウト", () => {
  it.each(["strikeout", "groundout", "flyout"] as const)("%s は走者を動かさない", (result) => {
    const transition = advanceRunners(state({ bases: bases("r1", null, "r3") }), "batter", result);

    expect(transition.outsAdded).toBe(1);
    expect(transition.basesAfter).toEqual(bases("r1", null, "r3"));
    expect(transition.runsScored).toEqual([]);
  });

  it("2アウトでも打者アウトの挙動は変わらない", () => {
    const transition = advanceRunners(state({ outs: 2, bases: bases("r1", null, "r3") }), "batter", "strikeout");

    expect(transition.basesAfter).toEqual(bases("r1", null, "r3"));
    expect(transition.runsScored).toEqual([]);
  });
});

describe("advanceRunners / 出塁", () => {
  it.each(["single", "walk", "hit_by_pitch", "error"] as const)("%s は打者が一塁に立ち走者が1つ進む", (result) => {
    const transition = advanceRunners(state({ bases: bases("r1", "r2", "r3") }), "batter", result);

    expect(transition.outsAdded).toBe(0);
    expect(transition.runsScored).toEqual(["r3"]);
    expect(transition.basesAfter).toEqual(bases("batter", "r1", "r2"));
  });

  it("二塁打は打者が二塁、二塁と三塁の走者が生還する", () => {
    const transition = advanceRunners(state({ bases: bases("r1", "r2", "r3") }), "batter", "double");

    expect(transition.runsScored).toEqual(["r3", "r2"]);
    expect(transition.rbi).toBe(2);
    expect(transition.basesAfter).toEqual(bases(null, "batter", "r1"));
  });

  it("三塁打は満塁の走者が全員生還する", () => {
    const transition = advanceRunners(state({ bases: bases("r1", "r2", "r3") }), "batter", "triple");

    expect(transition.runsScored).toEqual(["r3", "r2", "r1"]);
    expect(transition.rbi).toBe(3);
    expect(transition.basesAfter).toEqual(bases(null, null, "batter"));
  });

  it("満塁本塁打は打者を含む4人が生還し塁が空になる", () => {
    const transition = advanceRunners(state({ bases: bases("r1", "r2", "r3") }), "batter", "home_run");

    expect(transition.runsScored).toEqual(["r3", "r2", "r1", "batter"]);
    expect(transition.rbi).toBe(4);
    expect(transition.basesAfter).toEqual(empty);
  });
});

describe("nextHalfInning", () => {
  it("3アウト未満なら回も塁もそのまま", () => {
    const current = state({ inning: 3, half: "top", bases: bases("r1", null, null) });

    expect(nextHalfInning(current, 2)).toEqual({
      inning: 3,
      half: "top",
      outs: 2,
      bases: bases("r1", null, null)
    });
  });

  it("表の3アウトで同じ回の裏へ移り走者が消える", () => {
    const current = state({ inning: 3, half: "top", bases: bases("r1", "r2", "r3") });

    expect(nextHalfInning(current, 3)).toEqual({ inning: 3, half: "bottom", outs: 0, bases: empty });
  });

  it("裏の3アウトで次の回の表へ移る", () => {
    const current = state({ inning: 3, half: "bottom", bases: bases("r1", null, null) });

    expect(nextHalfInning(current, 4)).toEqual({ inning: 4, half: "top", outs: 0, bases: empty });
  });
});

describe("buildInningLabels", () => {
  it("6回までは常に6列出す", () => {
    expect(buildInningLabels(1)).toEqual(["1", "2", "3", "4", "5", "6"]);
    expect(buildInningLabels(6)).toEqual(["1", "2", "3", "4", "5", "6"]);
  });

  it("延長したら現在の回まで伸ばす", () => {
    expect(buildInningLabels(8)).toEqual(["1", "2", "3", "4", "5", "6", "7", "8"]);
  });
});

describe("buildScoreByInning", () => {
  const run = (inning: number, half: PlayEvent["half"], runners: string[]): PlayEvent => ({
    id: `${inning}-${half}-${runners.join()}`,
    inning,
    half,
    batterId: "batter",
    result: "single",
    notation: "1B",
    rbi: runners.length,
    outsAdded: 0,
    runsScored: runners,
    basesAfter: bases(null, null, null),
    scoringStatus: "provisional"
  });

  it("表と裏の得点を回ごとに分けて数える", () => {
    const events = [run(1, "top", ["a", "b"]), run(1, "bottom", ["c"]), run(3, "top", ["d"])];

    expect(buildScoreByInning(events, buildInningLabels(3))).toEqual([
      { inning: "1", topRuns: 2, bottomRuns: 1 },
      { inning: "2", topRuns: 0, bottomRuns: 0 },
      { inning: "3", topRuns: 1, bottomRuns: 0 },
      { inning: "4", topRuns: 0, bottomRuns: 0 },
      { inning: "5", topRuns: 0, bottomRuns: 0 },
      { inning: "6", topRuns: 0, bottomRuns: 0 }
    ]);
  });

  it("延長回の得点も列に出る（各回の合計と計が食い違わない）", () => {
    const events = [run(1, "top", ["a"]), run(8, "bottom", ["b", "c"])];
    const rows = buildScoreByInning(events, buildInningLabels(8));

    expect(rows).toHaveLength(8);
    expect(rows[7]).toEqual({ inning: "8", topRuns: 0, bottomRuns: 2 });

    const total = rows.reduce((sum, row) => sum + row.topRuns + row.bottomRuns, 0);
    expect(total).toBe(3);
  });
});

describe("チーム別の打順と取消", () => {
  const play = (game: GameState, result: PlateAppearanceResult = "strikeout"): GameState => {
    const batter = getCurrentLineupSlot(game);
    return applyPlayEvent(game, {
      id: `test-${game.events.length}`,
      inning: game.inning,
      half: game.half,
      batterId: batter.playerId,
      result,
      notation: result,
      ...advanceRunners(game, batter.playerId, result),
      scoringStatus: "provisional"
    });
  };
  const strikeouts = (game: GameState, count: number) =>
    Array.from({ length: count }).reduce<GameState>((current) => play(current), game);

  it("表を3人で終えても裏は別チームの1番から始まり、2回表は4番に戻る", () => {
    const bottom = strikeouts(initialGameState, 3);
    expect(bottom.half).toBe("bottom");
    expect(getCurrentLineupSlot(bottom)).toMatchObject({ order: 1, playerId: "home-p1" });
    const topSecond = strikeouts(bottom, 3);
    expect(topSecond.inning).toBe(2);
    expect(getCurrentLineupSlot(topSecond)).toMatchObject({ order: 4, playerId: "p4" });
    expect(topSecond.battingOrderIndex).toEqual({ top: 3, bottom: 3 });
  });

  it("打者一巡と延長でも相手の打順を進めない", () => {
    let game = Array.from({ length: 9 }).reduce<GameState>((current) => play(current, "home_run"), initialGameState);
    expect(getCurrentLineupSlot(game).order).toBe(1);
    expect(game.awayScore).toBe(9);
    expect(game.battingOrderIndex.bottom).toBe(0);
    game = strikeouts(game, 42);
    expect(game.inning).toBe(8);
    expect(game.half).toBe("top");
    expect(getCurrentLineupSlot(game).order).toBe(4);
    expect(game.battingOrderIndex).toEqual({ top: 30, bottom: 21 });
  });

  it("表裏の境界で取消すると2アウトの走者と打順まで戻る", () => {
    const before = strikeouts(play(initialGameState, "single"), 2);
    const after = play(before);
    expect(after.half).toBe("bottom");
    expect(after.bases).toEqual(empty);
    expect(undoLastPlay(after, initialGameState)).toEqual(before);
  });

  it("裏の得点と回の切替を取り消しても表の得点・打順は変わらない", () => {
    const bottom = strikeouts(play(initialGameState, "home_run"), 3);
    const scored = play(bottom, "home_run");
    expect(scored.homeScore).toBe(1);
    expect(undoLastPlay(scored, initialGameState)).toEqual(bottom);
    const before = strikeouts(scored, 2);
    expect(undoLastPlay(play(before), initialGameState)).toEqual(before);
  });

  it("保存された進塁結果を再計算せず復元する", () => {
    const game = play(initialGameState, "single");
    const saved = { ...game.events[0], basesAfter: bases(null, "p1", null) };
    const restored = applyPlayEvent(initialGameState, saved);
    expect(undoLastPlay(play(restored), initialGameState).bases).toEqual(saved.basesAfter);
  });

  it("全件取り消すと初期状態になり、空の取消も安全", () => {
    let game = strikeouts(initialGameState, 6);
    for (let i = 0; i < 6; i += 1) game = undoLastPlay(game, initialGameState);
    expect(game).toEqual(initialGameState);
    expect(undoLastPlay(game, initialGameState)).toEqual(initialGameState);
  });
});
