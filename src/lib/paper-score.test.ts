import { describe, expect, it } from "vitest";
import { buildCellRecord, buildPlayerSummary, findPlateAppearances } from "./paper-score";
import type { PlateAppearanceResult, PlayEvent, RunnerState } from "./types";

const bases = (first: string | null, second: string | null, third: string | null): RunnerState => ({
  first,
  second,
  third
});

const empty = bases(null, null, null);

let seq = 0;

/** テスト用のイベント。既定は1回表・アウトなし・打点なし */
const event = (overrides: Partial<PlayEvent> & { batterId: string; result: PlateAppearanceResult }): PlayEvent => ({
  id: `e${(seq += 1)}`,
  inning: 1,
  half: "top",
  notation: "-",
  rbi: 0,
  outsAdded: 0,
  runsScored: [],
  basesAfter: empty,
  scoringStatus: "provisional",
  ...overrides
});

describe("buildCellRecord / 到達した塁", () => {
  it("単打で一塁に立った打者は一塁到達", () => {
    const events = [event({ batterId: "a", result: "single", basesAfter: bases("a", null, null) })];

    expect(buildCellRecord(events, 0).reached).toBe(1);
  });

  it("三振はアウト扱いになる", () => {
    const events = [event({ batterId: "a", result: "strikeout", outsAdded: 1 })];
    const record = buildCellRecord(events, 0);

    expect(record.reached).toBe(0);
    expect(record.outNumber).toBe(1);
  });

  it("本塁打はその打席で生還になる", () => {
    const events = [event({ batterId: "a", result: "home_run", runsScored: ["a"], rbi: 1 })];

    expect(buildCellRecord(events, 0).reached).toBe(4);
  });

  it("後続の打者の安打で進塁した分まで反映する", () => {
    const events = [
      event({ batterId: "a", result: "single", basesAfter: bases("a", null, null) }),
      event({ batterId: "b", result: "single", basesAfter: bases("b", "a", null) })
    ];

    expect(buildCellRecord(events, 0).reached).toBe(2);
  });

  it("後続の打者に返されたら生還になる", () => {
    const events = [
      event({ batterId: "a", result: "single", basesAfter: bases("a", null, null) }),
      event({ batterId: "b", result: "home_run", runsScored: ["a", "b"], rbi: 2 })
    ];

    expect(buildCellRecord(events, 0).reached).toBe(4);
  });

  it("半回が変わったら追跡を打ち切り、残塁のままにする", () => {
    const events = [
      event({ batterId: "a", result: "single", basesAfter: bases("a", null, null) }),
      event({ batterId: "b", result: "flyout", outsAdded: 1, basesAfter: bases("a", null, null) }),
      // 3アウトで裏へ。別の半回の記録は追跡対象にしない
      event({ batterId: "c", result: "home_run", half: "bottom", runsScored: ["a", "c"], rbi: 2 })
    ];

    expect(buildCellRecord(events, 0).reached).toBe(1);
  });
});

describe("buildCellRecord / アウト番号", () => {
  it("その半回で何個目のアウトかを数える", () => {
    const events = [
      event({ batterId: "a", result: "strikeout", outsAdded: 1 }),
      event({ batterId: "b", result: "single", basesAfter: bases("b", null, null) }),
      event({ batterId: "c", result: "flyout", outsAdded: 1, basesAfter: bases("b", null, null) })
    ];

    expect(buildCellRecord(events, 0).outNumber).toBe(1);
    expect(buildCellRecord(events, 1).outNumber).toBeNull();
    expect(buildCellRecord(events, 2).outNumber).toBe(2);
  });

  it("半回が変わればアウト番号は1から数え直す", () => {
    const events = [
      event({ batterId: "a", result: "strikeout", outsAdded: 1 }),
      event({ batterId: "b", result: "strikeout", half: "bottom", outsAdded: 1 })
    ];

    expect(buildCellRecord(events, 1).outNumber).toBe(1);
  });
});

describe("findPlateAppearances", () => {
  it("同じ回に2打席あればどちらも返す（打者一巡）", () => {
    const events = [
      event({ batterId: "a", result: "single", basesAfter: bases("a", null, null) }),
      event({ batterId: "b", result: "walk", basesAfter: bases("b", "a", null) }),
      event({ batterId: "a", result: "double", basesAfter: bases(null, "a", "b") })
    ];

    expect(findPlateAppearances(events, "a", 1)).toEqual([0, 2]);
  });

  it("その回に打席がなければ空を返す", () => {
    const events = [event({ batterId: "a", result: "single", inning: 2 })];

    expect(findPlateAppearances(events, "a", 1)).toEqual([]);
  });
});

describe("buildPlayerSummary", () => {
  it("四球・死球・犠打を打数から除き、安打と打点と得点を数える", () => {
    const events = [
      event({ batterId: "a", result: "single" }),
      event({ batterId: "a", result: "walk" }),
      event({ batterId: "a", result: "sacrifice", outsAdded: 1 }),
      event({ batterId: "a", result: "hit_by_pitch" }),
      event({ batterId: "a", result: "home_run", runsScored: ["a"], rbi: 1 }),
      event({ batterId: "a", result: "strikeout", outsAdded: 1 }),
      // 他の打者に返されての得点も数える
      event({ batterId: "b", result: "double", runsScored: ["a"], rbi: 1 })
    ];

    expect(buildPlayerSummary(events, "a")).toEqual({ atBats: 3, hits: 2, rbi: 1, runs: 2 });
  });

  it("失策出塁は打数に数える", () => {
    const events = [event({ batterId: "a", result: "error" })];

    expect(buildPlayerSummary(events, "a")).toEqual({ atBats: 1, hits: 0, rbi: 0, runs: 0 });
  });
});

describe("buildCellRecord / 残塁", () => {
  it("3アウトで回が終わり塁に残っていれば残塁になる", () => {
    const events = [
      event({ batterId: "a", result: "single", basesAfter: bases("a", null, null) }),
      event({ batterId: "b", result: "strikeout", outsAdded: 1, basesAfter: bases("a", null, null) }),
      event({ batterId: "c", result: "strikeout", outsAdded: 1, basesAfter: bases("a", null, null) }),
      event({ batterId: "d", result: "strikeout", outsAdded: 1, basesAfter: bases("a", null, null) })
    ];

    expect(buildCellRecord(events, 0).leftOnBase).toBe(true);
  });

  it("回が続いている間は残塁にしない", () => {
    const events = [
      event({ batterId: "a", result: "single", basesAfter: bases("a", null, null) }),
      event({ batterId: "b", result: "strikeout", outsAdded: 1, basesAfter: bases("a", null, null) })
    ];

    expect(buildCellRecord(events, 0).leftOnBase).toBe(false);
  });

  it("生還していれば残塁にはならない", () => {
    const events = [
      event({ batterId: "a", result: "single", basesAfter: bases("a", null, null) }),
      event({ batterId: "b", result: "home_run", runsScored: ["a", "b"], rbi: 2 }),
      event({ batterId: "c", result: "strikeout", outsAdded: 1 }),
      event({ batterId: "d", result: "strikeout", outsAdded: 1 }),
      event({ batterId: "e", result: "strikeout", outsAdded: 1 })
    ];

    const record = buildCellRecord(events, 0);
    expect(record.reached).toBe(4);
    expect(record.leftOnBase).toBe(false);
  });

  it("アウトになった打者は残塁にならない", () => {
    const events = [
      event({ batterId: "a", result: "strikeout", outsAdded: 1 }),
      event({ batterId: "b", result: "strikeout", outsAdded: 1 }),
      event({ batterId: "c", result: "strikeout", outsAdded: 1 })
    ];

    expect(buildCellRecord(events, 0).leftOnBase).toBe(false);
  });
});
