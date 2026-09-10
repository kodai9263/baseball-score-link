import { buildPlayNotation, describePlay, detailMode, fieldPositions } from "@/lib/play-details";
import type { PlateAppearanceResult, PlayDetails } from "@/lib/types";

type Props = {
  result: PlateAppearanceResult;
  value: PlayDetails;
  onChange: (value: PlayDetails) => void;
};

export function PlayDetailPicker({ result, value, onChange }: Props) {
  const mode = detailMode(result);
  if (!mode) return null;
  const sequence = value.fieldingSequence ?? [];
  return (
    <fieldset className="mt-3 rounded-control border border-line p-3">
      <legend className="px-1 text-sm font-bold text-ink">
        {mode === "sequence" ? "守備の処理順" : result === "flyout" ? "捕球した守備位置" : "打球方向・守備位置"}
      </legend>
      <p className="mb-2 text-xs text-muted">
        {mode === "sequence" ? "捕球した人、送球先の順に押します。サード→ファーストなら 5−3。単独なら1人だけ選びます。"
          : "打球が飛んだ場所を選びます。数字は守備位置の番号です。"}
      </p>
      <div className="grid grid-cols-3 gap-1.5">
        {fieldPositions.map(({ value: position, label }) => (
          <button
            key={position}
            aria-label={`${position} ${label}`}
            type="button"
            aria-pressed={mode === "position" ? value.direction === position : undefined}
            onClick={() => onChange(mode === "sequence" ? { fieldingSequence: [...sequence, position] } : { ...value, direction: position })}
            className={`min-h-11 rounded border px-1 py-2 text-xs font-semibold disabled:opacity-40 ${mode === "position" && value.direction === position ? "border-primary bg-primary text-white" : "border-line bg-surface text-ink"}`}
          >
            <span className="mr-1 font-mono text-[10px]">{position}</span><span className="whitespace-nowrap text-[10px]">{label}</span>
          </button>
        ))}
      </div>
      {result === "hit_error" ? <label className="mt-2 block text-sm">失策した守備位置
        <select className="mt-1 min-h-11 w-full rounded border border-line bg-surface p-2" value={value.errorFielder ?? ""}
          onChange={event => onChange({ ...value, errorFielder: Number(event.target.value) as import("@/lib/types").FieldPosition || undefined })}>
          <option value="">選択してください</option>
          {fieldPositions.map(item => <option key={item.value} value={item.value}>{item.value} {item.label}</option>)}
        </select>
      </label> : null}
      <div className="mt-2 flex items-center justify-between gap-2">
        <p className="text-sm font-bold text-ink" aria-live="polite">
          {mode === "sequence" ? sequence.length ? sequence.join(" → ") : "処理順：未選択" : value.direction ? describePlay(result, value) : "方向：未選択"}
        </p>
        <button type="button" className="min-h-11 shrink-0 px-2 text-xs underline" onClick={() => onChange({})}>選択をクリア</button>
      </div>
      <p className="text-xs text-muted">
        記録内容：{buildPlayNotation(result, value)}
        {!value.direction && !sequence.length ? " ／ 守備位置・処理順を選択してください" : ""}
      </p>
    </fieldset>
  );
}
