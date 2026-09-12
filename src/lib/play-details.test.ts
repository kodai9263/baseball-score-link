import { describe, expect, it } from "vitest";
import { buildPlayNotation, describePlay, normalizePlayDetails } from "./play-details";
import { applyPlayEvent, undoLastPlay } from "./game-engine";
import { initialGameState } from "./score-data";
import type { PlayEvent } from "./types";

describe("打球方向と守備処理", () => {
  it("レフト前ヒットは7と単打を区別して表示する", () => {
    expect(describePlay("single", { direction: 7 })).toBe("レフト前ヒット");
    expect(buildPlayNotation("single", { direction: 7 })).toBe("7・1B");
    expect(buildPlayNotation("double", { direction: 9 })).toBe("9・2B");
  });
  it("サードゴロとショートゴロ、単独アウトを区別する", () => {
    expect(describePlay("groundout", { fieldingSequence: [5, 3] })).toBe("サードゴロ（5-3）");
    expect(buildPlayNotation("groundout", { fieldingSequence: [6, 3] })).toBe("6-3");
    expect(buildPlayNotation("groundout", { fieldingSequence: [3] })).toBe("3");
    expect(buildPlayNotation("groundout", { fieldingSequence: [1, 5, 4, 3] })).toBe("1-5-4-3");
  });
  it("フライと失策は選択された守備位置を使う", () => {
    expect(describePlay("flyout", { direction: 7 })).toBe("レフトフライ（F7）");
    expect(buildPlayNotation("flyout", { direction: 7 })).toBe("F7");
    expect(buildPlayNotation("error", { direction: 6 })).toBe("E6");
  });
  it("未選択をサード・センターなどに決めつけない", () => {
    expect(buildPlayNotation("groundout", {})).toBe("GO");
    expect(buildPlayNotation("flyout", {})).toBe("FO");
    expect(buildPlayNotation("error", {})).toBe("E");
  });
  it("結果に合わない方向や守備処理を保存しない", () => {
    const mixed = { direction: 7 as const, fieldingSequence: [5 as const, 3 as const] };
    expect(normalizePlayDetails("walk", mixed)).toEqual({});
    expect(normalizePlayDetails("single", mixed)).toEqual({ direction: 7 });
    expect(normalizePlayDetails("groundout", mixed)).toEqual({ fieldingSequence: [5, 3] });
    expect(buildPlayNotation("strikeout", mixed)).toBe("K");
  });
  it("記録と取消を経ても方向と既存の記号を保持する", () => {
    const oldEvent: PlayEvent = {
      id: "old", inning: 1, half: "top", batterId: "p1", result: "groundout",
      notation: "5-3", rbi: 0, outsAdded: 1, runsScored: [],
      basesAfter: { first: null, second: null, third: null }, scoringStatus: "provisional"
    };
    const oldGame = applyPlayEvent(initialGameState, oldEvent);
    const newEvent: PlayEvent = {
      ...oldEvent, id: "new", batterId: "p2", result: "single", direction: 7,
      notation: "7・1B", outsAdded: 0, basesAfter: { first: "p2", second: null, third: null }
    };
    const newGame = applyPlayEvent(oldGame, newEvent);
    expect(newGame.events[1].direction).toBe(7);
    expect(undoLastPlay(newGame, initialGameState)).toEqual(oldGame);
    expect(oldGame.events[0].notation).toBe("5-3");
  });
});
