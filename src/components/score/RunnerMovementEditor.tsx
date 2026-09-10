import { getPlayer } from "@/lib/score-data";
import type { Base, Destination, RunnerMovement, ThirdOutKind } from "@/lib/types";

type Props = {
  movements: RunnerMovement[];
  onChange: (moves: RunnerMovement[]) => void;
  thirdOutKind: ThirdOutKind | "";
  onThirdOutChange: (value: ThirdOutKind | "") => void;
  outs: number;
  hitError: boolean;
};
const baseLabels = { batter: "打者", first: "一塁走者", second: "二塁走者", third: "三塁走者" };

export function RunnerMovementEditor({ movements, onChange, thirdOutKind, onThirdOutChange, outs, hitError }: Props) {
  const update = (index: number, value: Partial<RunnerMovement>) => onChange(movements.map((move, i) => i === index ? { ...move, ...value } : move));
  const thirdOut = outs + movements.filter(move => move.to === "out").length >= 3;
  return (
    <fieldset className="mt-3 space-y-3 rounded-control border border-line p-3">
      <legend className="px-1 text-sm font-bold">プレー後の打者・走者</legend>
      <p className="text-xs text-muted">実際に到達した塁・アウトを確認してください。アウトが複数なら成立した順番も指定します。</p>
      {movements.length === 0 ? <p className="text-sm">走者がいません。</p> : null}
      {movements.map((move, index) => (
        <div key={move.playerId} className="space-y-2 border-b border-line pb-2">
          <label className="block text-sm">
            {baseLabels[move.from]}：{getPlayer(move.playerId).name}
            <select aria-label={`${baseLabels[move.from]}の行き先`} className="mt-1 min-h-11 w-full rounded border border-line bg-surface p-2"
              value={move.to} onChange={event => update(index, { to: event.target.value as Destination, outOrder: event.target.value === "out" ? move.outOrder ?? 1 : undefined })}>
              <option value="first">一塁</option><option value="second">二塁</option><option value="third">三塁</option>
              <option value="home">本塁（生還）</option><option value="out">アウト</option>
            </select>
          </label>
          {move.to === "out" ? <label className="block text-xs">アウトになった塁
            <select aria-label={`${baseLabels[move.from]}のアウト位置`} className="ml-2 min-h-11 rounded border border-line bg-surface px-2"
              value={move.outAt ?? (move.from === "first" ? "second" : move.from === "second" ? "third" : move.from === "third" ? "home" : "first")}
              onChange={event => update(index, { outAt: event.target.value as Base | "home" })}>
              <option value="first">一塁</option><option value="second">二塁</option><option value="third">三塁</option><option value="home">本塁</option>
            </select>
          </label> : null}
          {move.to === "out" ? <label className="block text-xs">このプレー内のアウト成立順
            <select aria-label={`${baseLabels[move.from]}のアウト成立順`} className="ml-2 min-h-11 rounded border border-line bg-surface px-2" value={move.outOrder ?? 1} onChange={event => update(index, { outOrder: Number(event.target.value) })}>
              {[1, 2, 3].map(order => <option key={order} value={order}>{order}番目</option>)}
            </select>
          </label> : null}
          {hitError && move.from === "batter" ? <label className="block text-xs">安打だけで到達した塁
            <select aria-label="安打で到達した塁" value={move.via ?? ""} className="ml-2 min-h-11 border border-line bg-surface px-2" onChange={event => update(index, { via: event.target.value as Base || undefined })}>
              <option value="">選択</option><option value="first">一塁</option><option value="second">二塁</option><option value="third">三塁</option>
            </select>
          </label> : null}
          {thirdOut && move.to === "home" ? <label className="flex min-h-11 items-center gap-2 text-xs">
            <input type="checkbox" checked={move.scoredBeforeThirdOut ?? false} onChange={event => update(index, { scoredBeforeThirdOut: event.target.checked })} />
            第3アウトより先に生還した
          </label> : null}
        </div>
      ))}
      {thirdOut ? <label className="block text-sm">3アウト目の種類
        <select className="mt-1 min-h-11 w-full rounded border border-line bg-surface p-2" value={thirdOutKind} onChange={event => onThirdOutChange(event.target.value as ThirdOutKind | "")}>
          <option value="">選択してください</option><option value="force">フォースアウト（得点なし）</option>
          <option value="batter_before_first">打者が一塁到達前にアウト（得点なし）</option>
          <option value="caught_fly">打者の飛球を捕球（得点なし）</option>
          <option value="tag">その他のアウト（先に生還した走者のみ得点）</option>
        </select>
      </label> : null}
    </fieldset>
  );
}
