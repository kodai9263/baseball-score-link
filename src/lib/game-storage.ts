import { applyPlayEvent } from "./game-engine";
import { getCurrentLineupSlot, initialGameState, players, lineups, resultLabels } from "./score-data";
import { isRunnerResult, resolveMovements } from "./play-resolution";
import type { GameState, PlayEvent, Player, LineupChange } from "./types";
import { applyLineupChange, replaceRunner, validateChange } from "./lineup-changes";

// 集計値を重複保存せず、記録済みイベントから同じ手順で復元する。
export const GAME_STORAGE_KEY = "baseball-score-link:sample-game:v1";
export const GAME_STORAGE_LOCK = `${GAME_STORAGE_KEY}:write`;
type StoragePort = Pick<Storage, "getItem" | "setItem">;
const roster = players.map(player => player.id);
const isObject = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const isInteger = (value: unknown, min: number, max: number) => Number.isInteger(value) && Number(value) >= min && Number(value) <= max;

const isPosition = (value: unknown) => isInteger(value, 1, 9);
const bases = ["first", "second", "third"];
const thirdOutKinds = ["force", "batter_before_first", "tag", "caught_fly"];

function isEvent(value: unknown, roster: string[]): value is PlayEvent {
  const isPlayer = (value: unknown) => typeof value === "string" && roster.includes(value);
  if (!isObject(value) || typeof value.id !== "string" || !value.id || !isInteger(value.inning, 1, 999) ||
      !["top", "bottom"].includes(String(value.half)) || !isPlayer(value.batterId) ||
      typeof value.result !== "string" || !Object.hasOwn(resultLabels, value.result) ||
      typeof value.notation !== "string" || !isInteger(value.rbi, 0, 4) || !isInteger(value.outsAdded, 0, 3) ||
      !["provisional", "confirmed"].includes(String(value.scoringStatus)) ||
      !Array.isArray(value.runsScored) || value.runsScored.length > 4 || !value.runsScored.every(isPlayer) ||
      new Set(value.runsScored).size !== value.runsScored.length || !isObject(value.basesAfter)) return false;
  const after = value.basesAfter;
  if (!bases.every(base => after[base] === null || isPlayer(after[base]))) return false;
  if (value.kind !== undefined && value.kind !== "plate" && value.kind !== "runner") return false;
  if (value.direction !== undefined && !isPosition(value.direction)) return false;
  if (value.errorFielder !== undefined && !isPosition(value.errorFielder)) return false;
  if (value.fieldingSequence !== undefined && (!Array.isArray(value.fieldingSequence) || !value.fieldingSequence.every(isPosition))) return false;
  if (value.thirdOutKind !== undefined && !thirdOutKinds.includes(String(value.thirdOutKind))) return false;
  if (value.movements !== undefined && (!Array.isArray(value.movements) || !value.movements.every(move =>
    isObject(move) && isPlayer(move.playerId) && [...bases, "batter"].includes(String(move.from)) &&
    [...bases, "home", "out"].includes(String(move.to)) &&
    (move.outOrder === undefined || isInteger(move.outOrder, 1, 3)) &&
    (move.outAt === undefined || [...bases, "home"].includes(String(move.outAt))) &&
    (move.via === undefined || bases.includes(String(move.via))) &&
    (move.reason === undefined || typeof move.reason === "string") &&
    (move.scoredBeforeThirdOut === undefined || typeof move.scoredBeforeThirdOut === "boolean")
  ))) return false;
  return true;
}

export function encodeGame(game: GameState): string {
  return JSON.stringify({ version: 1, roster, events: game.events });
}

export function decodeGame(raw: string | null, matchPlayers: Player[] = players, matchLineups = lineups, changes: LineupChange[] = []): GameState {
  const roster = matchPlayers.map(player => player.id);
  if (raw === null) return initialGameState;
  const invalid = () => new Error("保存済みの記録を読み込めません。元のデータは上書きしていません。");
  let data: unknown;
  try { data = JSON.parse(raw); } catch { throw invalid(); }
  if (!isObject(data) || data.version !== 1 || JSON.stringify(data.roster) !== JSON.stringify(roster) || !Array.isArray(data.events)) throw invalid();
  let game = initialGameState;
  const ids = new Set<string>();
  let activeLineups = matchLineups;
  const used = new Set(Object.values(matchLineups).flat().map(slot => slot.playerId));
  let cursor = 0;
  const applyChanges = () => {
    while (cursor < changes.length && changes[cursor]?.beforePlay === game.events.length) {
      const change = changes[cursor++];
      validateChange(change, game, activeLineups, used, roster);
      if (ids.has(change.id)) throw invalid();
      ids.add(change.id);
      used.add(change.incomingId);
      activeLineups = applyLineupChange(activeLineups, change);
      game = replaceRunner(game, change);
    }
  };
  for (const event of data.events) {
    applyChanges();
    if (!isEvent(event, roster) || ids.has(event.id) || event.inning !== game.inning || event.half !== game.half ||
        event.batterId !== getCurrentLineupSlot(game, activeLineups).playerId || game.outs + event.outsAdded > 3 ||
        event.rbi > event.runsScored.length || (event.kind === "runner") !== isRunnerResult(event.result)) throw invalid();
    const participants = [event.batterId, ...Object.values(game.bases)].filter(Boolean);
    const survivors = [...Object.values(event.basesAfter).filter(Boolean), ...event.runsScored];
    if (new Set(survivors).size !== survivors.length || survivors.some(id => !participants.includes(id))) throw invalid();
    if (event.movements) {
      const resolution = resolveMovements(game, event.batterId, event.result, event.movements, event.thirdOutKind ?? "", event, event.rbi);
      if (resolution.error !== null || resolution.transition.outsAdded !== event.outsAdded ||
          resolution.transition.rbi !== event.rbi ||
          bases.some(base => resolution.transition.basesAfter[base as keyof typeof event.basesAfter] !== event.basesAfter[base as keyof typeof event.basesAfter]) ||
          JSON.stringify(resolution.transition.runsScored) !== JSON.stringify(event.runsScored)) throw invalid();
    }
    ids.add(event.id);
    game = applyPlayEvent(game, event);
  }
  applyChanges();
  if (cursor !== changes.length) throw invalid();
  return game;
}

// 呼び出し側のWeb Lock内で比較と保存を行い、別タブの新しい記録を守る。
export function saveGame(storage: StoragePort, previousRaw: string | null, game: GameState): string {
  if (storage.getItem(GAME_STORAGE_KEY) !== previousRaw) throw new Error("別の画面で記録が更新されました。再読み込みしてから続けてください。");
  const raw = encodeGame(game);
  storage.setItem(GAME_STORAGE_KEY, raw);
  return raw;
}
