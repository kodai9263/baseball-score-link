import { describe, expect, it } from "vitest";
import { advanceRunners, nextHalfInning } from "./game-engine";
import { initialGameState } from "./score-data";
import type { GameState, RunnerState } from "./types";

const bases = (first: string | null, second: string | null, third: string | null): RunnerState => ({
  first,
  second,
  third
});

const empty = bases(null, null, null);

const state = (overrides: Partial<GameState> = {}): GameState => ({ ...initialGameState, ...overrides });

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
