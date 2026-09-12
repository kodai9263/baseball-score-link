import type { DHSetup, GameState, Half, LineupChange, LineupSlot } from "./types";

export const changeLabels = { hitter: "代打", runner: "代走", defense: "守備交代", position: "守備位置変更", pitcher: "投手交代", dh_end: "DH解除" };
export const positions = ["投手", "捕手", "一塁手", "二塁手", "三塁手", "遊撃手", "左翼手", "中堅手", "右翼手"];
export const defaultSources: Record<Half, Half> = { top: "top", bottom: "bottom" };

export function validateDHSetup(dh: DHSetup, lineups: Record<Half, LineupSlot[]>, roster: string[]) {
  const fail = () => { throw new Error("DHの打順と、打順9人とは別の投手を確認してください。"); };
  if (!dh || typeof dh !== "object" || Array.isArray(dh) || Object.keys(dh).some(key => key !== "top" && key !== "bottom")) return fail();
  const used = new Set(Object.values(lineups).flat().map(slot => slot.playerId));
  for (const half of ["top", "bottom"] as const) {
    const setup = dh[half];
    if (setup !== undefined) {
      if (!setup || typeof setup !== "object" || !Number.isInteger(setup.order) || setup.order < 1 || setup.order > 9 ||
          !roster.includes(setup.pitcherId) || used.has(setup.pitcherId) || lineups[half][setup.order - 1].position !== "DH") return fail();
      const actual = lineups[half].map(slot => slot.position);
      if (new Set(actual).size !== 9 || actual.some(position => ![...positions.slice(1), "DH"].includes(position))) return fail();
      used.add(setup.pitcherId);
    } else if (lineups[half].some(slot => slot.position === "DH")) return fail();
  }
}

export function applyLineupChange(lineups: Record<Half, LineupSlot[]>, change: LineupChange) {
  const previous = lineups[change.team][change.order - 1];
  return { ...lineups, [change.team]: lineups[change.team].map(slot => {
    if (slot.order === change.order) return { ...slot, playerId: change.incomingId, position: change.position };
    // 守備位置の変更では、その位置の選手と入れ替える。打順は動かさない。
    if (slot.position === change.position && change.position !== previous.position) return { ...slot, position: previous.position };
    return slot;
  }) };
}

export type LineupState = { lineups: Record<Half, LineupSlot[]>; pitchers: Partial<Record<Half, string>> };
type LineupMatch = { lineups: Record<Half, LineupSlot[]>; changes?: LineupChange[]; dh?: DHSetup };
export function initialLineupState(match: LineupMatch): LineupState {
  return { lineups: match.lineups, pitchers: Object.fromEntries(Object.entries(match.dh ?? {}).map(([half, setup]) => [half, setup.pitcherId])) };
}

// DH解除で動く複数の守備位置・打順を、必ず1件の操作として再生する。
export function advanceLineup(state: LineupState, change: LineupChange): LineupState {
  if (change.kind === "pitcher") return { ...state, pitchers: { ...state.pitchers, [change.team]: change.incomingId } };
  if (change.kind !== "dh_end") return { ...state, lineups: applyLineupChange(state.lineups, change) };
  const pitcherId = state.pitchers[change.team]!;
  const pitchers = { ...state.pitchers };
  delete pitchers[change.team];
  const lineup = state.lineups[change.team].map(slot => {
    if (slot.order === change.order) return { ...slot, playerId: change.dhEnd === "dh_fields" ? slot.playerId : pitcherId, position: change.position };
    if (slot.position === change.position && change.position !== "投手") return { ...slot,
      playerId: change.dhEnd === "dh_fields" ? pitcherId : slot.playerId, position: "投手" };
    return slot;
  });
  return { lineups: { ...state.lineups, [change.team]: lineup }, pitchers };
}
export function currentLineupState(match: LineupMatch) {
  return (match.changes ?? []).reduce(advanceLineup, initialLineupState(match));
}
export function currentLineups(match: LineupMatch) {
  return currentLineupState(match).lineups;
}

// 打順外の投手も表示し、DH解除で打順に入ったら同じ選手の行を移す。
export function paperLineupRows(match: LineupMatch, half: Half) {
  const rows = new Map<string, LineupSlot & { entry?: LineupChange }>();
  const collect = (state: LineupState, entry?: LineupChange) => {
    const pitcherId = state.pitchers[half];
    for (const slot of [...state.lineups[half], ...(pitcherId ? [{ order: 0, playerId: pitcherId, position: "投手" }] : [])]) {
      const previous = rows.get(slot.playerId);
      rows.set(slot.playerId, { ...slot, entry: previous ? previous.entry ?? (previous.order === 0 && slot.order > 0 ? entry : undefined) : entry });
    }
  };
  let state = initialLineupState(match);
  collect(state);
  for (const change of match.changes ?? []) { state = advanceLineup(state, change); collect(state, change); }
  return [...rows.values()].sort((a, b) => (a.order || 10) - (b.order || 10));
}

// 復元時にもUIと同じ条件を検証し、不正な交代を黙って適用しない。
export function validateChange(change: LineupChange, game: GameState, lineups: Record<Half, LineupSlot[]>, used: Set<string>, roster: string[], pitchers: LineupState["pitchers"] = {}) {
  const fail = () => { throw new Error("交代内容を確認してください。再出場や他の打順への移動はできません。"); };
  if (!change || typeof change !== "object" || typeof change.id !== "string" || !change.id ||
      !Number.isInteger(change.beforePlay) || change.beforePlay !== game.events.length ||
      !["top", "bottom"].includes(change.team) || !Number.isInteger(change.order) || change.order < 0 || change.order > 9 ||
      !Object.hasOwn(changeLabels, change.kind) || ![...positions, "DH"].includes(change.position) || !roster.includes(change.incomingId)) return fail();
  const pitcherId = pitchers[change.team];
  if (change.kind === "pitcher") {
    if (!pitcherId || change.order !== 0 || change.outgoingId !== pitcherId || used.has(change.incomingId) || change.position !== "投手" || game.half === change.team || change.dhEnd !== undefined) return fail();
    return;
  }
  if (change.order < 1) return fail();
  const slot = lineups[change.team][change.order - 1];
  if (slot.playerId !== change.outgoingId || !roster.includes(change.incomingId)) return fail();
  if (change.kind === "dh_end") {
    if (!pitcherId || slot.position !== "DH" || !positions.includes(change.position)) return fail();
    if (change.dhEnd === "pitcher_bats") {
      if (change.incomingId !== pitcherId || change.position !== "投手" || game.half !== change.team ||
        (change.order !== game.battingOrderIndex[game.half] % 9 + 1 && !Object.values(game.bases).includes(slot.playerId))) return fail();
    } else if (change.dhEnd === "dh_fields" || change.dhEnd === "pitcher_fields") {
      if (game.half === change.team || change.incomingId !== (change.dhEnd === "dh_fields" ? slot.playerId : pitcherId) ||
        (change.dhEnd === "pitcher_fields" && change.position === "投手") ||
        (change.position !== "投手" && !lineups[change.team].some(item => item.position === change.position))) return fail();
    } else return fail();
    return;
  }
  if (change.dhEnd !== undefined) return fail();
  if (pitcherId && (change.kind === "defense" || change.kind === "position") && (slot.position === "DH" || change.position === "投手" || change.position === "DH")) {
    throw new Error("この変更ではDHが解除されます。「DH解除」から記録してください。");
  }
  if (change.position === "DH" && (!pitcherId || slot.position !== "DH")) return fail();
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
  if (change.kind !== "runner" && !(change.kind === "dh_end" && change.dhEnd === "pitcher_bats")) return game;
  return { ...game, bases: {
    first: game.bases.first === change.outgoingId ? change.incomingId : game.bases.first,
    second: game.bases.second === change.outgoingId ? change.incomingId : game.bases.second,
    third: game.bases.third === change.outgoingId ? change.incomingId : game.bases.third
  } };
}
