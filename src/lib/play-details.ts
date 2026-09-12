import { resultLabels } from "./score-data";
import type { FieldPosition, PlateAppearanceResult, PlayDetails, PlayEvent } from "./types";

export const fieldPositions: { value: FieldPosition; label: string }[] = [
  { value: 1, label: "ピッチャー" }, { value: 2, label: "キャッチャー" },
  { value: 3, label: "ファースト" }, { value: 4, label: "セカンド" },
  { value: 5, label: "サード" }, { value: 6, label: "ショート" },
  { value: 7, label: "レフト" }, { value: 8, label: "センター" }, { value: 9, label: "ライト" }
];

export const detailMode = (result: PlateAppearanceResult) =>
  ["groundout", "sacrifice", "double_play", "caught_stealing", "tag_out", "rundown", "fielders_choice", "runner_error", "error"].includes(result) ? "sequence"
    : ["single", "double", "triple", "home_run", "flyout", "foul_fly", "lineout", "infield_hit", "bunt_hit", "hit_error"].includes(result) ? "position" : null;

export function normalizePlayDetails(result: PlateAppearanceResult, details: PlayDetails): PlayDetails {
  if (detailMode(result) === "sequence") {
    return details.fieldingSequence?.length ? { fieldingSequence: [...details.fieldingSequence] } : result === "error" && details.direction ? { direction: details.direction } : {};
  }
  if (detailMode(result) === "position") return details.direction ? { direction: details.direction, ...(result === "hit_error" && details.errorFielder ? { errorFielder: details.errorFielder } : {}) } : {};
  return {};
}

export function buildPlayNotation(result: PlateAppearanceResult, details: PlayDetails): string {
  const clean = normalizePlayDetails(result, details);
  const sequence = clean.fieldingSequence?.join("-");
  if (sequence) {
    if (result === "sacrifice") return `SAC ${sequence}`;
    if (result === "error" || result === "runner_error") return `${sequence}E`;
    if (result === "groundout") return sequence;
    return `${resultLabels[result].notation} ${sequence}`;
  }
  if (clean.direction) {
    if (result === "foul_fly") return `${clean.direction}F`;
    if (result === "lineout") return `L${clean.direction}`;
    if (result === "hit_error") return `${clean.direction}H+E`;
    if (result === "flyout") return `F${clean.direction}`;
    if (result === "error") return `E${clean.direction}`;
    // 安打の種類と打球方向を分け、塁間の線と併せて読む簡略表記。
    return `${clean.direction}・${resultLabels[result].notation}`;
  }
  const unknown = { groundout: "GO", flyout: "FO", error: "E" };
  return unknown[result as keyof typeof unknown] ?? resultLabels[result].notation;
}

export function describePlay(result: PlateAppearanceResult, details: PlayDetails): string {
  const clean = normalizePlayDetails(result, details);
  const position = clean.direction ?? clean.fieldingSequence?.[0];
  const name = fieldPositions.find((item) => item.value === position)?.label;
  if (!name) return resultLabels[result].label;
  if (result === "groundout") return `${name}ゴロ（${buildPlayNotation(result, clean)}）`;
  if (result === "sacrifice") return `犠打（${buildPlayNotation(result, clean)}）`;
  if (result === "flyout") return `${name}フライ（F${position}）`;
  if (result === "single") return position! >= 7 ? `${name}前ヒット` : `${name}への内野安打`;
  return `${name}方向の${resultLabels[result].label}`;
}

/** 既存イベントに方向がなくても、記録済みの記号は変更しない。 */
export const describePlayEvent = (event: PlayEvent) => describePlay(event.result, event);
