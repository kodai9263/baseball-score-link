import type { Player } from "@/lib/types";

type BatterCardProps = {
  order: number;
  player: Player;
};

/** 現在の打者。打順・名前・背番号・守備位置を1枚にまとめる */
export function BatterCard({ order, player }: BatterCardProps) {
  return (
    <div className="rounded-control border border-line bg-sunken px-3 py-2.5">
      <p className="text-xs font-semibold text-muted">現在の打者</p>
      <div className="mt-0.5 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
        <span className="text-sm font-bold tabular-nums text-primary">{order}番</span>
        <span className="text-xl font-bold text-ink">{player.name}</span>
      </div>
      <p className="mt-0.5 text-sm text-muted">
        <span className="tabular-nums">背番号 {player.number}</span>
        <span aria-hidden="true"> ・ </span>
        {player.position}
        <span aria-hidden="true"> ・ </span>
        {player.grade}
        <span aria-hidden="true"> ・ </span>
        {player.bats}打
      </p>
    </div>
  );
}
