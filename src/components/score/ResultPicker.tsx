"use client";

import { Check } from "lucide-react";
import { additionalResultGroups, resultGroups, resultLabels } from "@/lib/score-data";
import type { PlateAppearanceResult } from "@/lib/types";

type ResultPickerProps = {
  value: PlateAppearanceResult;
  onChange: (result: PlateAppearanceResult) => void;
};

/**
 * 打席結果の選択。
 * 安打・出塁・アウトの3群に分けるが、タブで隠さず同一画面に並べるので、
 * どの結果も従来どおり1タップで選べる。
 */
export function ResultPicker({ value, onChange }: ResultPickerProps) {
  return (
    <div className="space-y-2.5">
      <label className="block text-sm font-bold">
        すべてのプレーから選択
        <select className="mt-1 min-h-11 w-full rounded-control border border-line bg-surface p-2 text-sm" value={value}
          onChange={(event) => onChange(event.target.value as PlateAppearanceResult)}>
          {[...resultGroups.map(group => ({ label: group.label, results: group.results })), ...additionalResultGroups].map(group => (
            <optgroup key={group.label} label={group.label}>
              {group.results.map(result => <option key={result} value={result}>{resultLabels[result].label}</option>)}
            </optgroup>
          ))}
        </select>
      </label>
      {resultGroups.map((group) => (
        <fieldset key={group.id} className="rounded-control border border-line bg-sunken px-2.5 pb-2.5 pt-1.5">
          <legend className="px-1 text-xs font-bold text-muted">{group.label}</legend>
          {/* 640px以上では各群が1行に収まるようにして、タブレットでボタンが間延びしないようにする */}
          <div
            className={`grid gap-2 ${
              group.results.length === 3
                ? "grid-cols-2 sm:grid-cols-3 lg:grid-cols-2"
                : "grid-cols-2 sm:grid-cols-4 lg:grid-cols-2"
            }`}
          >
            {group.results.map((result, index) => {
              const option = resultLabels[result];
              const selected = value === result;
              // 奇数個の群は最後の1つを2列分に広げ、余白の抜けを作らない
              const isLoneLast = group.results.length % 2 === 1 && index === group.results.length - 1;

              return (
                <button
                  key={result}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => onChange(result)}
                  className={`flex min-h-[54px] select-none flex-col justify-center gap-0.5 rounded-control border-2 px-2 py-1.5 text-left transition-colors duration-150 ${
                    isLoneLast ? "col-span-2 sm:col-span-1 lg:col-span-2" : ""
                  } ${
                    selected
                      ? "border-primary bg-primary text-white active:bg-primary-dark"
                      : "border-line bg-surface text-ink hover:border-primary hover:bg-primary-soft active:bg-primary-soft"
                  }`}
                >
                  <span className="flex min-w-0 items-center gap-1">
                    {/* 選択時にレイアウトがずれないよう、非選択でも領域は確保しておく */}
                    <Check
                      size={14}
                      aria-hidden="true"
                      className={`shrink-0 transition-opacity duration-150 ${selected ? "opacity-100" : "opacity-0"}`}
                    />
                    <span className="min-w-0 truncate text-[15px] font-bold leading-tight">{option.label}</span>
                  </span>
                  {/* 記号は初心者向け名称より控えめに。名称を切らないよう2行目に置く */}
                  <span
                    className={`pl-[18px] font-mono text-[11px] font-semibold leading-none ${
                      selected ? "text-primary-soft" : "text-muted"
                    }`}
                  >
                    {option.notation}
                  </span>
                </button>
              );
            })}
          </div>
        </fieldset>
      ))}
    </div>
  );
}
