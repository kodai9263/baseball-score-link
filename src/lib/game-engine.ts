import type { GameState, PlateAppearanceResult, PlayEvent, RunnerState } from "./types";

// 試合進行の計算だけを持つ層。画面に依存しないので単体テストできる。

export function advanceRunners(
  state: GameState,
  batterId: string,
  result: PlateAppearanceResult
): Pick<PlayEvent, "basesAfter" | "runsScored" | "rbi" | "outsAdded"> {
  const bases = state.bases;
  const runsScored: string[] = [];
  let nextBases: RunnerState = { first: null, second: null, third: null };
  let outsAdded = 0;

  if (result === "strikeout" || result === "groundout" || result === "flyout" || result === "sacrifice") {
    outsAdded = 1;
    nextBases = bases;
  }

  if (result === "single" || result === "walk" || result === "hit_by_pitch" || result === "error") {
    if (bases.third) runsScored.push(bases.third);
    nextBases = { first: batterId, second: bases.first, third: bases.second };
  }

  if (result === "double") {
    if (bases.third) runsScored.push(bases.third);
    if (bases.second) runsScored.push(bases.second);
    nextBases = { first: null, second: batterId, third: bases.first };
  }

  if (result === "triple") {
    if (bases.third) runsScored.push(bases.third);
    if (bases.second) runsScored.push(bases.second);
    if (bases.first) runsScored.push(bases.first);
    nextBases = { first: null, second: null, third: batterId };
  }

  if (result === "home_run") {
    if (bases.third) runsScored.push(bases.third);
    if (bases.second) runsScored.push(bases.second);
    if (bases.first) runsScored.push(bases.first);
    runsScored.push(batterId);
    nextBases = { first: null, second: null, third: null };
  }

  return {
    basesAfter: nextBases,
    runsScored,
    rbi: runsScored.length,
    outsAdded
  };
}

export function nextHalfInning(state: GameState, outsAfterPlay: number): Pick<GameState, "inning" | "half" | "outs" | "bases"> {
  if (outsAfterPlay < 3) {
    return { inning: state.inning, half: state.half, outs: outsAfterPlay, bases: state.bases };
  }

  return {
    inning: state.half === "top" ? state.inning : state.inning + 1,
    half: state.half === "top" ? "bottom" : "top",
    outs: 0,
    bases: { first: null, second: null, third: null }
  };
}
