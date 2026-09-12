import type { LineupChange, PlateAppearanceResult, PlayEvent } from "./types";

// 紙スコアの表示に必要な情報を、記録済みイベントから復元する層。
// 試合進行の計算には手を出さず、読み取りだけを行う。

/** 安打として数える打席結果 */
const hitResults: PlateAppearanceResult[] = ["single", "double", "triple", "home_run", "infield_hit", "bunt_hit", "hit_error"];

/** 打数に数えない打席結果 */
const notAtBatResults: PlateAppearanceResult[] = ["walk", "hit_by_pitch", "sacrifice", "intentional_walk"];

/** 到達した塁。0=アウト、1〜3=各塁、4=生還 */
export type Reached = 0 | 1 | 2 | 3 | 4;

export type CellRecord = {
  event: PlayEvent;
  reached: Reached;
  /** その半回で何個目のアウトだったか。アウトでなければ null */
  outNumber: number | null;
  /** その半回が終わり、塁に残ったまま（残塁）になったか */
  leftOnBase: boolean;
  notes?: { text: string; base: number }[];
};

/** ある選手のその回の打席を、記録順にすべて返す。打者一巡すると同じ回に複数入る */
export function findPlateAppearances(events: PlayEvent[], playerId: string, inning: number): number[] {
  return events.reduce<number[]>((indexes, event, index) => {
    if (event.kind !== "runner" && event.batterId === playerId && event.inning === inning) {
      indexes.push(index);
    }

    return indexes;
  }, []);
}

/**
 * 1つの打席を紙スコアのマスに描くための情報を復元する。
 * 打席時点の到達塁は basesAfter から読み、その後の進塁と生還は
 * 同じ半回の後続イベントを追って求める。
 */
export function buildCellRecord(events: PlayEvent[], index: number, changes: LineupChange[] = []): CellRecord {
  const event = events[index];
  let playerId = event.batterId;

  let reached: Reached = 0;
  if (event.runsScored.includes(playerId)) {
    reached = 4;
  } else if (event.basesAfter.third === playerId) {
    reached = 3;
  } else if (event.basesAfter.second === playerId) {
    reached = 2;
  } else if (event.basesAfter.first === playerId) {
    reached = 1;
  }

  const rank = { batter: 0, first: 1, second: 2, third: 3, home: 4, out: 0 };
  const notes: { text: string; base: number }[] = [];
  let outNumber: number | null = null;
  let totalOuts = events.slice(0, index).filter(item => item.inning === event.inning && item.half === event.half)
    .reduce((sum, item) => sum + item.outsAdded, 0);
  let finished = false;
  for (let i = index; i <= events.length; i += 1) {
    const later = events[i];
    if (later && (later.inning !== event.inning || later.half !== event.half)) break;
    if (i > index && !finished && reached > 0 && reached < 4) {
      for (const change of changes.filter(change => change.beforePlay === i && (change.kind === "runner" || (change.kind === "dh_end" && change.dhEnd === "pitcher_bats")))) {
        if (change.outgoingId !== playerId) continue;
        playerId = change.incomingId;
        notes.push({ text: "代走", base: reached });
      }
    }
    if (!later) break;
    if (i > index && later.kind !== "runner" && later.batterId === playerId) break;
    const move = later.movements?.find(item => item.playerId === playerId);
    if (move && !finished) {
      if (move.to === "out") {
        outNumber = totalOuts + (move.outOrder ?? 1);
        if (i > index) notes.push({ text: later.notation, base: move.outAt ? rank[move.outAt] : Math.min(4, rank[move.from] + 1) });
        finished = true;
      } else {
        if (move.to !== "home" || later.runsScored.includes(playerId)) reached = Math.max(reached, rank[move.to]) as Reached;
        if (move.to === "home") finished = true;
        if (move.reason && move.to !== move.from) notes.push({ text: move.reason, base: rank[move.to] });
      }
    } else if (!later.movements && !finished) {
      // 旧イベントは従来どおり保存済みの塁状況から復元する。
      if (i === index && later.outsAdded > 0) { outNumber = totalOuts + later.outsAdded; finished = true; }
      else if (later.runsScored.includes(playerId)) { reached = 4; finished = true; }
      else if (later.basesAfter.third === playerId) reached = Math.max(reached, 3) as Reached;
      else if (later.basesAfter.second === playerId) reached = Math.max(reached, 2) as Reached;
    }
    totalOuts += later.outsAdded;
  }
  const halfIsOver = events.filter(item => item.inning === event.inning && item.half === event.half)
    .reduce((total, item) => total + item.outsAdded, 0) >= 3;
  const leftOnBase = !outNumber && reached >= 1 && reached <= 3 && halfIsOver;

  return { event, reached, outNumber, leftOnBase, ...(notes.length ? { notes } : {}) };
}

/** 選手ごとの打数・安打・打点・得点。表右側の成績欄に出す */
export function buildPlayerSummary(events: PlayEvent[], playerId: string) {
  const own = events.filter((event) => event.kind !== "runner" && event.batterId === playerId);

  return {
    atBats: own.filter((event) => !notAtBatResults.includes(event.result)).length,
    hits: own.filter((event) => hitResults.includes(event.result)).length,
    rbi: own.reduce((total, event) => total + event.rbi, 0),
    runs: events.filter((event) => event.runsScored.includes(playerId)).length
  };
}
