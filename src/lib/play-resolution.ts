import { advanceRunners } from "./game-engine";
import { buildPlayNotation } from "./play-details";
import type { Base, GameState, PlateAppearanceResult, PlayDetails, RunnerMovement, ThirdOutKind } from "./types";

const runnerResults: PlateAppearanceResult[] = ["stolen_base", "caught_stealing", "balk", "wild_pitch", "passed_ball", "runner_error", "tag_out", "rundown"];
export const isRunnerResult = (result: PlateAppearanceResult) => runnerResults.includes(result);
const outResults: PlateAppearanceResult[] = ["strikeout", "groundout", "flyout", "foul_fly", "lineout", "sacrifice", "double_play"];
const bases: Base[] = ["first", "second", "third"];
const rank = { batter: 0, first: 1, second: 2, third: 3, home: 4, out: 5 };

export function suggestedMovements(game: GameState, batterId: string, result: PlateAppearanceResult): RunnerMovement[] {
  const participants: { playerId: string; from: Base | "batter" }[] = bases.flatMap(from =>
    game.bases[from] ? [{ playerId: game.bases[from]!, from }] : []
  );
  if (!isRunnerResult(result)) participants.push({ playerId: batterId, from: "batter" });
  if (isRunnerResult(result)) return participants.map(item => ({
    ...item, to: result === "balk" ? item.from === "first" ? "second" : item.from === "second" ? "third" : "home" : item.from as Base
  }));
  const transition = advanceRunners(game, batterId, result);
  return participants.map(item => {
    const destination = bases.find(base => transition.basesAfter[base] === item.playerId);
    return {
      ...item,
      to: item.from === "batter" && outResults.includes(result) ? "out" : transition.runsScored.includes(item.playerId) ? "home" : destination ?? item.from as Base,
      ...(item.from === "batter" && outResults.includes(result) ? { outOrder: 1 } : {})
    };
  });
}

export function resolveMovements(
  game: GameState, batterId: string, result: PlateAppearanceResult,
  movements: RunnerMovement[], thirdOutKind: ThirdOutKind | "", details: PlayDetails,
  requestedRbi?: number
) {
  const fail = (error: string) => ({ error } as const);
  const expected = suggestedMovements(game, batterId, result);
  if (expected.length !== movements.length || expected.some(item => !movements.some(move => move.playerId === item.playerId && move.from === item.from)) ||
      new Set(movements.map(move => move.playerId)).size !== movements.length) return fail("打者と走者の行き先を確認してください。");
  if (isRunnerResult(result) && !movements.length) return fail("塁上に走者がいません。");
  const occupied = movements.filter(move => bases.includes(move.to as Base)).map(move => move.to);
  if (new Set(occupied).size !== occupied.length) return fail("同じ塁に2人を置くことはできません。");
  if (movements.some(move => move.to !== "out" && rank[move.to] < rank[move.from])) return fail("走者を元の塁より前に戻すことはできません。");
  const safe = movements.filter(move => move.to !== "out" && move.to !== "home");
  if (safe.some(a => safe.some(b => rank[a.from] > rank[b.from] && rank[a.to] < rank[b.to]))) return fail("前の走者を追い越す進塁は指定できません。行き先を確認してください。");
  const outs = movements.filter(move => move.to === "out");
  if (game.outs + outs.length > 3) return fail("アウト数が3を超えています。");
  const orders = outs.map(move => move.outOrder);
  if (outs.some((_, i) => !orders.includes(i + 1)) || new Set(orders).size !== orders.length) return fail("アウトの成立順を1から重複なく指定してください。");
  const batter = movements.find(move => move.from === "batter");
  if (outResults.includes(result) && batter?.to !== "out") return fail("この打席結果では打者をアウトにしてください。");
  if (result === "double_play" && outs.length !== 2) return fail("併殺では2人をアウトにし、成立順を指定してください。");
  if (["caught_stealing", "tag_out", "rundown"].includes(result) && outs.length !== 1) return fail("対象の走者1人をアウトにしてください。");
  if (["caught_stealing", "tag_out", "rundown", "double_play", "fielders_choice", "error", "runner_error"].includes(result) && !details.fieldingSequence?.length && !details.direction) return fail("守備の処理順を入力してください。");
  if (isRunnerResult(result) && !movements.some(move => move.to !== move.from)) return fail("対象の走者の進塁先またはアウトを指定してください。");
  if (["stolen_base", "balk", "wild_pitch", "passed_ball", "runner_error"].includes(result) && outs.length) return fail("このプレーでは進塁を記録します。アウトは盗塁死・タッチアウト・挟殺で記録してください。");
  if (result === "balk" && movements.some(move => rank[move.to] !== rank[move.from] + 1)) return fail("ボークでは各走者を1つ進めてください。");
  if (result === "dropped_third" && game.outs < 2 && game.bases.first) return fail("2アウト未満で一塁に走者がいるため、振り逃げではなく三振を選んでください。");
  if (["walk", "hit_by_pitch", "intentional_walk"].includes(result) &&
      movements.some(move => move.to !== expected.find(item => item.playerId === move.playerId)?.to)) return fail("四死球・申告敬遠は押し出される走者だけを進めます。追加の進塁は別プレーで記録してください。");
  if (result === "hit_error" && (!details.errorFielder || !details.direction || !batter?.via || rank[batter.to] <= rank[batter.via])) return fail("安打で到達した塁と、失策後の進塁先・守備位置を指定してください。");
  if (batter?.via && (batter.to === "out" || rank[batter.via] > rank[batter.to])) return fail("安打による到達塁と最終の行き先を確認してください。");

  const minimumBase = { single: 1, infield_hit: 1, bunt_hit: 1, double: 2, triple: 3, home_run: 4 }[result as "single" | "double" | "triple" | "home_run" | "infield_hit" | "bunt_hit"];
  if (minimumBase && batter && (batter.to === "out" || rank[batter.to] < minimumBase)) return fail("安打で打者が到達した塁以上を指定してください。進塁中のアウトは続けて走塁プレーで記録します。");
  if (result === "home_run" && movements.some(move => move.to !== "home")) return fail("本塁打では打者と全走者を生還にしてください。");
  if (result === "fielders_choice" && batter?.to === "out") return fail("野手選択は打者の出塁先を指定してください。");
  const isThirdOut = game.outs + outs.length === 3;
  const lastOut = outs.find(move => move.outOrder === outs.length);
  const batterBeforeFirst = isThirdOut && lastOut?.from === "batter" && ["strikeout", "groundout", "sacrifice", "double_play"].includes(result);
  const caughtFly = isThirdOut && lastOut?.from === "batter" && ["flyout", "foul_fly", "lineout"].includes(result);
  if (isThirdOut && !batterBeforeFirst && !caughtFly && !thirdOutKind) return fail("3アウト目の種類を選択してください。");
  const effectiveKind = caughtFly ? "caught_fly" : batterBeforeFirst ? "batter_before_first" : thirdOutKind;
  const runsScored = movements.filter(move => move.to === "home" &&
    (!isThirdOut || (effectiveKind === "tag" && move.scoredBeforeThirdOut))).map(move => move.playerId);
  const noRbi = isRunnerResult(result) || ["error", "double_play", "dropped_third"].includes(result);
  const rbi = noRbi ? 0 : requestedRbi ?? (result === "hit_error" ? 0 : runsScored.length);
  if (!Number.isInteger(rbi) || rbi < 0 || rbi > runsScored.length) return fail("打点は認められた得点以下で指定してください。");
  const basesAfter = { first: null, second: null, third: null } as GameState["bases"];
  for (const move of movements) if (bases.includes(move.to as Base)) basesAfter[move.to as Base] = move.playerId;
  const savedMovements = movements.map(move => ({
    ...move,
    reason: move.reason?.trim() || (isRunnerResult(result) ? buildPlayNotation(result, details) : result === "hit_error" && move.from === "batter" ? `${details.errorFielder}E` : undefined)
  }));
  return { error: null, transition: { basesAfter, runsScored, rbi, outsAdded: outs.length }, movements: savedMovements, thirdOutKind: effectiveKind || undefined };
}
