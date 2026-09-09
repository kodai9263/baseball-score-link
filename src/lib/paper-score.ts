import type { PlateAppearanceResult, PlayEvent } from "./types";

// 紙スコアの表示に必要な情報を、記録済みイベントから復元する層。
// 試合進行の計算には手を出さず、読み取りだけを行う。

/** 安打として数える打席結果 */
const hitResults: PlateAppearanceResult[] = ["single", "double", "triple", "home_run"];

/** 打数に数えない打席結果 */
const notAtBatResults: PlateAppearanceResult[] = ["walk", "hit_by_pitch", "sacrifice"];

/** 到達した塁。0=アウト、1〜3=各塁、4=生還 */
export type Reached = 0 | 1 | 2 | 3 | 4;

export type CellRecord = {
  event: PlayEvent;
  reached: Reached;
  /** その半回で何個目のアウトだったか。アウトでなければ null */
  outNumber: number | null;
};

/** ある選手のその回の打席を、記録順にすべて返す。打者一巡すると同じ回に複数入る */
export function findPlateAppearances(events: PlayEvent[], playerId: string, inning: number): number[] {
  return events.reduce<number[]>((indexes, event, index) => {
    if (event.batterId === playerId && event.inning === inning) {
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
export function buildCellRecord(events: PlayEvent[], index: number): CellRecord {
  const event = events[index];
  const playerId = event.batterId;

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

  // 出塁していれば、同じ半回の後続プレーでどこまで進んだかを追う
  if (reached > 0 && reached < 4) {
    for (let i = index + 1; i < events.length; i += 1) {
      const later = events[i];
      if (later.inning !== event.inning || later.half !== event.half) break;

      if (later.runsScored.includes(playerId)) {
        reached = 4;
        break;
      }
      if (later.basesAfter.third === playerId) reached = Math.max(reached, 3) as Reached;
      else if (later.basesAfter.second === playerId) reached = Math.max(reached, 2) as Reached;
    }
  }

  let outNumber: number | null = null;
  if (event.outsAdded > 0) {
    outNumber = events
      .slice(0, index + 1)
      .filter((item) => item.inning === event.inning && item.half === event.half)
      .reduce((total, item) => total + item.outsAdded, 0);
  }

  return { event, reached, outNumber };
}

/** 選手ごとの打数・安打・打点・得点。表右側の成績欄に出す */
export function buildPlayerSummary(events: PlayEvent[], playerId: string) {
  const own = events.filter((event) => event.batterId === playerId);

  return {
    atBats: own.filter((event) => !notAtBatResults.includes(event.result)).length,
    hits: own.filter((event) => hitResults.includes(event.result)).length,
    rbi: own.reduce((total, event) => total + event.rbi, 0),
    runs: events.filter((event) => event.runsScored.includes(playerId)).length
  };
}
