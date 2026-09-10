import type { PlayEvent } from "./types";

/** 入力・保存用の表記と、用紙上の記号を分離する。 */
export function paperSymbol(event: PlayEvent) {
  const hitBases = { single: 1, double: 2, triple: 3, home_run: 4, infield_hit: 1, bunt_hit: 1 }[event.result as "single" | "double" | "triple" | "home_run" | "infield_hit" | "bunt_hit"] ?? 0;
  if (event.result === "hit_error") {
    const via = event.movements?.find(move => move.from === "batter")?.via;
    return { text: event.direction ? String(event.direction) : "?", hitBases: via === "third" ? 3 : via === "second" ? 2 : 1, fly: false };
  }
  if (hitBases) {
    return { text: event.direction ? String(event.direction) : "?", hitBases, fly: false };
  }
  if (event.result === "flyout" || event.result === "foul_fly") {
    // 旧形式のF7なども既に記録されている番号だけを使う。
    const position = event.direction ?? /^F([1-9])$/.exec(event.notation)?.[1];
    return { text: (position ? String(position) : "?") + (event.result === "foul_fly" ? "F" : ""), hitBases: 0, fly: true };
  }
  if (event.result === "lineout") return { text: event.direction ? String(event.direction) : "?", hitBases: 0, fly: false, liner: true };
  if (event.result === "intentional_walk") return { text: "DIB", hitBases: 0, fly: false };
  if (event.result === "dropped_third") return { text: "K", hitBases: 0, fly: false, reverseK: true };
  if (event.result === "walk") return { text: "B", hitBases: 0, fly: false };
  if (event.result === "hit_by_pitch") return { text: "DB", hitBases: 0, fly: false };
  if (event.result === "error" && event.direction) return { text: `${event.direction}E`, hitBases: 0, fly: false };
  return { text: event.notation, hitBases: 0, fly: false };
}
