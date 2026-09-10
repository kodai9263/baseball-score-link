import type { GameState, Half, LineupChange, LineupSlot } from "./types";

export const changeLabels = { hitter: "代打", runner: "代走", defense: "守備交代", position: "守備位置変更" };
export const positions = ["投手", "捕手", "一塁手", "二塁手", "三塁手", "遊撃手", "左翼手", "中堅手", "右翼手"];
export const defaultSources: Record<Half, Half> = { top: "top", bottom: "bottom" };

export function applyLineupChange(lineups: Record<Half, LineupSlot[]>, change: LineupChange) {
  const previous = lineups[change.team][change.order - 1];
  return { ...lineups, [change.team]: lineups[change.team].map(slot => {
    if (slot.order === change.order) return { ...slot, playerId: change.incomingId, position: change.position };
    // 守備位置の変更では、その位置の選手と入れ替える。打順は動かさない。
    if (slot.position === change.position && change.position !== previous.position) return { ...slot, position: previous.position };
    return slot;
  }) };
}

export function currentLineups(match: { lineups: Record<Half, LineupSlot[]>; changes?: LineupChange[] }) {
  return (match.changes ?? []).reduce(applyLineupChange, match.lineups);
}

// 復元時にもUIと同じ条件を検証し、不正な交代を黙って適用しない。
export function validateChange(change: LineupChange, game: GameState, lineups: Record<Half, LineupSlot[]>, used: Set<string>, roster: string[]) {
  const fail = () => { throw new Error("交代内容を確認してください。再出場や他の打順への移動はできません。"); };
  if (!change || typeof change !== "object" || typeof change.id !== "string" || !change.id ||
      !Number.isInteger(change.beforePlay) || change.beforePlay !== game.events.length ||
      !["top", "bottom"].includes(change.team) || !Number.isInteger(change.order) || change.order < 1 || change.order > 9 ||
      !Object.hasOwn(changeLabels, change.kind) || !positions.includes(change.position)) return fail();
  const slot = lineups[change.team][change.order - 1];
  if (slot.playerId !== change.outgoingId || !roster.includes(change.incomingId)) return fail();
  if (change.kind === "position") {
    if (change.incomingId !== change.outgoingId || change.position === slot.position) return fail();
  } else if (used.has(change.incomingId)) return fail();
  const isRunner = Object.values(game.bases).includes(change.outgoingId);
  if (change.kind === "runner") {
    if (game.half !== change.team || !isRunner) return fail();
  } else if (change.kind === "hitter") {
    if (game.half !== change.team || change.order !== game.battingOrderIndex[game.half] % 9 + 1 || isRunner) return fail();
  } else if (game.half === change.team) return fail();
  if (["hitter", "runner"].includes(change.kind) && change.position !== slot.position) return fail();
}

export function replaceRunner(game: GameState, change: LineupChange): GameState {
  if (change.kind !== "runner") return game;
  return { ...game, bases: {
    first: game.bases.first === change.outgoingId ? change.incomingId : game.bases.first,
    second: game.bases.second === change.outgoingId ? change.incomingId : game.bases.second,
    third: game.bases.third === change.outgoingId ? change.incomingId : game.bases.third
  } };
}
