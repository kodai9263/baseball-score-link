import { getPlayer } from "@/lib/score-data";
import type { RunnerState } from "@/lib/types";

type BaseDiamondProps = {
  bases: RunnerState;
};

/** 塁の並びをダイヤモンド形に置くための定義。走者名は隣のリスト側で読ませる */
const baseOrder = [
  { key: "first", label: "一塁" },
  { key: "second", label: "二塁" },
  { key: "third", label: "三塁" }
] as const;

function BaseMark({ occupied }: { occupied: boolean }) {
  return (
    <span
      className={`block h-[18px] w-[18px] rotate-45 rounded-[3px] border-2 ${
        occupied ? "border-primary bg-primary" : "border-line bg-surface"
      }`}
    />
  );
}

/**
 * 走者状況。
 * 図は形（塗り／白抜き）で伝え、走者名は隣の一覧に文字で出す。
 * 名前が長くても図が崩れないよう、図と文字を分けている。
 */
export function BaseDiamond({ bases }: BaseDiamondProps) {
  return (
    <div className="flex items-center gap-3">
      {/* 図は装飾なので読み上げ対象にしない。内容は右のリストが持つ */}
      <div className="grid w-[84px] shrink-0 grid-cols-3 grid-rows-3 place-items-center gap-0.5" aria-hidden="true">
        <span />
        <BaseMark occupied={Boolean(bases.second)} />
        <span />
        <BaseMark occupied={Boolean(bases.third)} />
        <span />
        <BaseMark occupied={Boolean(bases.first)} />
        <span />
        <span className="block h-2.5 w-2.5 rotate-45 rounded-[2px] bg-line" />
        <span />
      </div>

      <ul className="min-w-0 flex-1 space-y-0.5" aria-label="走者状況">
        {baseOrder.map((base) => {
          const runnerId = bases[base.key];

          return (
            <li key={base.key} className="flex items-baseline gap-2 text-sm">
              <span className="w-8 shrink-0 text-xs font-semibold text-muted">{base.label}</span>
              <span
                className={`min-w-0 truncate ${
                  runnerId ? "font-bold text-primary-dark" : "text-muted"
                }`}
              >
                {runnerId ? getPlayer(runnerId).name : "走者なし"}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
