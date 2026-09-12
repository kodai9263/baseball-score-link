import { expect, it } from "vitest";
import { paperSymbol } from "./paper-symbol";
import type { PlayEvent } from "./types";

const event = (overrides: Partial<PlayEvent>): PlayEvent => ({
  id: "test", inning: 1, half: "top", batterId: "p1", result: "single",
  notation: "7・1B", direction: 7, rbi: 0, outsAdded: 0, runsScored: [],
  basesAfter: { first: "p1", second: null, third: null }, scoringStatus: "provisional",
  ...overrides
});

it.each([["single", 1], ["double", 2], ["triple", 3], ["home_run", 4]] as const)(
  "%sは赤い塁間線の本数と守備番号で表す",
  (result, count) => expect(paperSymbol(event({ result }))).toEqual({ text: "7", hitBases: count, fly: false })
);
it("ゴロは処理順、フライは番号と弧で表す", () => {
  expect(paperSymbol(event({ result: "groundout", notation: "5-3", direction: undefined })).text).toBe("5-3");
  expect(paperSymbol(event({ result: "flyout" }))).toEqual({ text: "7", hitBases: 0, fly: true });
});
it("四球と死球を写真のBとDBに合わせる", () => {
  expect(paperSymbol(event({ result: "walk" })).text).toBe("B");
  expect(paperSymbol(event({ result: "hit_by_pitch" })).text).toBe("DB");
});
it("旧記録の守備番号は保持し、不明な方向は推測しない", () => {
  expect(paperSymbol(event({ result: "flyout", direction: undefined, notation: "F8" })).text).toBe("8");
  expect(paperSymbol(event({ direction: undefined })).text).toBe("?");
});
