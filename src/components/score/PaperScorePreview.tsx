"use client";

import { useEffect, useRef, useState } from "react";
import { MoveHorizontal } from "lucide-react";
import { buildCellRecord, buildPlayerSummary, findPlateAppearances } from "@/lib/paper-score";
import type { CellRecord } from "@/lib/paper-score";
import { getPlayer, lineup, resultLabels } from "@/lib/score-data";
import type { PlayEvent } from "@/lib/types";

type PaperScorePreviewProps = {
  events: PlayEvent[];
  /** 表示するイニング。延長したときは6回より伸びる */
  innings: string[];
  currentInning: number;
};

const baseWords = ["アウト", "一塁", "二塁", "三塁", "生還"] as const;

/**
 * 打席1つ分のマス。早稲田式の記入法に合わせている。
 *
 * - ひし形の頂点が各塁。下=本塁、右=一塁、上=二塁、左=三塁
 * - 走者が到達した塁まで塁間に斜線を引く
 * - 打席結果の記号は一塁の区画（右下）に書く
 * - 中央には、アウトなら I / II / III、生還なら ●、残塁なら ℓ を置く
 * - アウトになったプレーの記号にはアンダーラインを引く
 * - 3アウトチェンジのときはマスの右下角に斜線2本を入れる
 */
function DiamondMark({ record, label }: { record: CellRecord | null; label: string | null }) {
  const reached = record?.reached ?? 0;
  const traveled = (leg: number) => reached >= leg;
  const isOut = Boolean(record?.outNumber);

  return (
    <svg
      viewBox="0 0 72 72"
      className="h-auto w-full max-w-[96px]"
      role={label ? "img" : "presentation"}
      aria-label={label ?? undefined}
      aria-hidden={label ? undefined : true}
    >
      {/* 空欄でも塁の罫は残し、白紙のスコアブックに見えるようにする */}
      <polygon points="36,62 62,36 36,10 10,36" fill="none" stroke="var(--color-line)" strokeWidth="1.2" />

      {/* 到達した塁まで塁間に斜線を引く。本塁→一塁→二塁→三塁→本塁の順 */}
      <g stroke="var(--color-ink)" strokeWidth="3" strokeLinecap="round">
        {traveled(1) ? <line x1="36" y1="62" x2="62" y2="36" /> : null}
        {traveled(2) ? <line x1="62" y1="36" x2="36" y2="10" /> : null}
        {traveled(3) ? <line x1="36" y1="10" x2="10" y2="36" /> : null}
        {traveled(4) ? <line x1="10" y1="36" x2="36" y2="62" /> : null}
      </g>

      {/* 中央。アウト数・得点・残塁は同時に起こらないので同じ場所を使う */}
      {record?.outNumber ? (
        <text
          x="36"
          y="42"
          textAnchor="middle"
          className="fill-ink text-[19px] font-bold"
          style={{ fontFamily: "var(--font-mono)", letterSpacing: "-0.5px" }}
        >
          {"I".repeat(record.outNumber)}
        </text>
      ) : null}
      {reached === 4 ? <circle cx="36" cy="36" r="8" fill="var(--color-primary)" /> : null}
      {record?.leftOnBase ? (
        <text x="36" y="44" textAnchor="middle" className="fill-ink text-[22px] italic">
          ℓ
        </text>
      ) : null}

      {/* 打席結果の記号は一塁の区画（右下）。アウトのプレーにはアンダーラインを引く */}
      {record ? (
        <>
          <text
            x="51"
            y="59"
            textAnchor="middle"
            className="text-[13px] font-bold"
            style={{
              fontFamily: "var(--font-mono)",
              fill: "var(--color-ink)",
              stroke: "var(--color-surface)",
              strokeWidth: 3.5,
              paintOrder: "stroke"
            }}
          >
            {record.event.notation}
          </text>
          {isOut ? <line x1="38" y1="63" x2="64" y2="63" stroke="var(--color-ink)" strokeWidth="1.4" /> : null}
        </>
      ) : null}

      {/* 3アウトチェンジは右下角に斜線2本 */}
      {record?.outNumber === 3 ? (
        <g stroke="var(--color-ink)" strokeWidth="2" strokeLinecap="round">
          <line x1="58" y1="70" x2="70" y2="58" />
          <line x1="64" y1="70" x2="70" y2="64" />
        </g>
      ) : null}

      {/* 打点は左下に点で示す */}
      {record && record.event.rbi > 0
        ? Array.from({ length: Math.min(record.event.rbi, 4) }).map((_, index) => (
            <circle key={index} cx={6 + index * 7} cy={66} r="2.6" fill="var(--color-ink)" />
          ))
        : null}
    </svg>
  );
}

function describe(cellName: string, record: CellRecord, order: string) {
  return [
    cellName + order,
    resultLabels[record.event.result].label,
    baseWords[record.reached],
    record.leftOnBase ? "残塁" : null,
    record.outNumber ? `この回${record.outNumber}アウト目` : null,
    record.event.rbi > 0 ? `打点${record.event.rbi}` : null
  ]
    .filter(Boolean)
    .join("、");
}

/**
 * 紙スコアのマス1つ。
 * 打者一巡して同じ回に2打席立った場合は、紙のスコアブックと同じように
 * 同じマスへ縦に並べる。打席を隠さない。
 */
function ScoreCell({ records, cellName }: { records: CellRecord[]; cellName: string }) {
  // 得点したマスだけ薄く色を敷き、何点入った回かを目で追えるようにする（中央の●との二重表現）。
  // 現在のイニングは見出しの強調だけにして、色が競合しないようにする。
  const scored = records.some((record) => record.reached === 4);

  return (
    <div
      className={`flex min-h-[92px] flex-col items-center justify-center gap-2 border-r border-t border-line p-1.5 ${
        scored ? "bg-primary-soft" : ""
      }`}
    >
      {records.length === 0 ? (
        <DiamondMark record={null} label={null} />
      ) : (
        records.map((record, index) => (
          <DiamondMark
            key={record.event.id}
            record={record}
            label={describe(cellName, record, records.length > 1 ? ` ${index + 1}打席目` : "")}
          />
        ))
      )}
    </div>
  );
}

function SummaryCell({ value, emphasized = false }: { value: number; emphasized?: boolean }) {
  return (
    <div
      className={`flex min-h-[92px] items-center justify-center border-r border-t border-line tabular-nums ${
        emphasized ? "bg-sunken text-base font-bold text-ink" : "text-sm text-muted"
      }`}
    >
      {value}
    </div>
  );
}

/**
 * 紙スコア風プレビュー。
 * これは入力UIではなく出力プレビューなので、罫線と記号の可読性を優先し装飾は足さない。
 */
export function PaperScorePreview({ events, innings, currentInning }: PaperScorePreviewProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScroll, setCanScroll] = useState(false);

  // 実際にはみ出しているときだけ案内を出す。画面幅と回数の両方で変わるため実測する
  useEffect(() => {
    const node = scrollRef.current;
    if (!node) return;

    const update = () => setCanScroll(node.scrollWidth > node.clientWidth + 1);
    update();

    const observer = new ResizeObserver(update);
    observer.observe(node);

    return () => observer.disconnect();
  }, [innings.length]);

  // 打順128px + 各回88px以上 + 成績欄4列44px
  const gridTemplateColumns = `128px repeat(${innings.length}, minmax(88px, 1fr)) repeat(4, 44px)`;
  const minWidth = 128 + innings.length * 88 + 176;

  return (
    <div>
      {canScroll ? (
        <p className="mb-2 flex items-center gap-1.5 text-xs text-muted">
          <MoveHorizontal size={14} aria-hidden="true" />
          横にスクロールすると{innings.length}回と成績欄まで見られます
        </p>
      ) : null}

      <div ref={scrollRef} className="overflow-x-auto rounded-control border border-line bg-surface">
        <div
          className="grid text-sm"
          style={{ gridTemplateColumns, minWidth }}
          role="group"
          aria-label="打順ごとの打席結果プレビュー"
        >
          <div className="border-b border-r border-line bg-sunken px-2 py-2.5 text-xs font-bold text-muted">
            打順
          </div>
          {innings.map((inning) => {
            const isCurrent = Number(inning) === currentInning;

            return (
              <div
                key={inning}
                className={`border-b border-r border-line px-2 py-2.5 text-center text-xs font-bold tabular-nums ${
                  isCurrent ? "bg-primary-soft text-primary-dark" : "bg-sunken text-muted"
                }`}
              >
                {inning}回
                {isCurrent ? <span className="sr-only">（現在のイニング）</span> : null}
              </div>
            );
          })}
          {["打数", "安打", "打点", "得点"].map((label) => (
            <div
              key={label}
              className="border-b border-r border-line bg-sunken px-1 py-2.5 text-center text-[11px] font-bold text-muted"
            >
              {label}
            </div>
          ))}

          {lineup.map((slot) => {
            const player = getPlayer(slot.playerId);
            const summary = buildPlayerSummary(events, player.id);

            return (
              <div key={player.id} className="contents">
                <div className="flex flex-col justify-center border-r border-t border-line px-2 py-2">
                  <p className="truncate font-bold text-ink">
                    <span className="tabular-nums">{slot.order}.</span> {player.name}
                  </p>
                  <p className="truncate text-xs text-muted">
                    <span className="tabular-nums">#{player.number}</span> {slot.position}
                  </p>
                </div>

                {innings.map((inning) => (
                  <ScoreCell
                    key={`${player.id}-${inning}`}
                    cellName={`${inning}回 ${slot.order}番 ${player.name}`}
                    records={findPlateAppearances(events, player.id, Number(inning)).map((index) =>
                      buildCellRecord(events, index)
                    )}
                  />
                ))}

                <SummaryCell value={summary.atBats} />
                <SummaryCell value={summary.hits} emphasized />
                <SummaryCell value={summary.rbi} />
                <SummaryCell value={summary.runs} emphasized />
              </div>
            );
          })}
        </div>
      </div>

      <p className="mt-2 text-xs leading-relaxed text-muted">
        早稲田式の記入法に合わせています。ひし形の頂点は下から反時計回りに本塁・一塁・二塁・三塁で、塁間の太線は走者が到達した塁を表します。
        打席結果の記号は一塁側（右下）、中央はアウトなら <span className="font-mono font-bold">I</span> /{" "}
        <span className="font-mono font-bold">II</span> / <span className="font-mono font-bold">III</span>、生還なら ●、残塁なら ℓ です。
        アウトになったプレーの記号には下線、3アウトチェンジは右下角の斜線2本、左下の点は打点を示します。
      </p>
    </div>
  );
}
