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

  if (result === "strikeout" || result === "groundout" || result === "flyout") {
    outsAdded = 1;
    nextBases = bases;
  }

  if (result === "sacrifice") {
    outsAdded = 1;

    if (state.outs + outsAdded >= 3) {
      // 打者走者が一塁に触れる前に第3アウトが成立するので得点は認められない
      // （公認野球規則5.08(a)）。走者も進めずに回を終える。
      nextBases = bases;
    } else {
      // 犠打は打者と引き換えに走者を1つずつ進める。走者が進まなければ犠打として成立しない。
      if (bases.third) runsScored.push(bases.third);
      nextBases = { first: null, second: bases.first, third: bases.second };
    }
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

/**
 * イニング別得点。表と裏を分けて集計する。
 * 集計対象の回は呼び出し側から渡す（延長時は6回より伸びる）。
 */
export function buildScoreByInning(events: PlayEvent[], innings: string[]) {
  return innings.map((inningLabel) => {
    const inning = Number(inningLabel);
    const topRuns = events
      .filter((event) => event.inning === inning && event.half === "top")
      .reduce((total, event) => total + event.runsScored.length, 0);
    const bottomRuns = events
      .filter((event) => event.inning === inning && event.half === "bottom")
      .reduce((total, event) => total + event.runsScored.length, 0);

    return { inning: inningLabel, topRuns, bottomRuns };
  });
}


/** 記録済みの進塁・得点を適用する。取消時も再計算せず同じ処理で復元する。 */
export function applyPlayEvent(state: GameState, event: PlayEvent): GameState {
  const transition = nextHalfInning(
    { ...state, inning: event.inning, half: event.half, bases: event.basesAfter },
    state.outs + event.outsAdded
  );

  return {
    ...state,
    ...transition,
    battingOrderIndex: {
      ...state.battingOrderIndex,
      [event.half]: state.battingOrderIndex[event.half] + 1
    },
    awayScore: state.awayScore + (event.half === "top" ? event.runsScored.length : 0),
    homeScore: state.homeScore + (event.half === "bottom" ? event.runsScored.length : 0),
    events: [...state.events, event],
    status: "provisional"
  };
}

/** 直前の打席を取り消し、両チームの打順を含む試合状況を復元する。 */
export function undoLastPlay(state: GameState, initialState: GameState): GameState {
  if (state.events.length === 0) return state;
  return state.events.slice(0, -1).reduce(applyPlayEvent, initialState);
}
