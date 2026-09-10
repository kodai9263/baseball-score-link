"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./PaperScorePreview.module.css";
import { MoveHorizontal } from "lucide-react";
import { buildCellRecord, buildPlayerSummary, findPlateAppearances } from "@/lib/paper-score";
import type { CellRecord } from "@/lib/paper-score";
import { useMatch } from "./MatchContext";
import { paperSymbol } from "@/lib/paper-symbol";
import { describePlayEvent } from "@/lib/play-details";
import type { Half, PlayEvent } from "@/lib/types";

type PaperScorePreviewProps = {
  events: PlayEvent[];
  /** 表示するイニング。延長したときは6回より伸びる */
  innings: string[];
  currentInning: number;
  currentHalf: Half;
};

const baseWords = ["アウト", "一塁", "二塁", "三塁", "生還"] as const;

/**
 * 打席1つ分のマス。早稲田式の記入法に合わせている。
 *
 * - ひし形の頂点が各塁。下=本塁、右=一塁、上=二塁、左=三塁
 * - 走者が到達した塁まで塁間に斜線を引く
 * - 打席結果の記号は一塁の区画（右下）に書く
 * - 中央には、アウトなら I / II / III、生還なら赤い○、残塁なら ℓ を置く
 * - フライは守備番号の上に弧を添える
 * - 3アウトチェンジのときはマスの右下角に斜線2本を入れる
 */
function DiamondMark({ record, label }: { record: CellRecord | null; label: string | null }) {
  const reached = record?.reached ?? 0;
  const traveled = (leg: number) => reached >= leg;
  const symbol = record ? paperSymbol(record.event) : null;

  return (
    <svg
      viewBox="0 0 72 72"
      className={styles.diamond}
      role={label ? "img" : "presentation"}
      aria-label={label ?? undefined}
      aria-hidden={label ? undefined : true}
    >
      {/* 空欄でも塁の罫は残し、白紙のスコアブックに見えるようにする */}
      <polygon points="36,53 53,36 36,19 19,36" fill="none" stroke="#9bafa6" strokeWidth="0.7" strokeDasharray="1.4 1.4" />

      {/* 安打そのもので獲得した塁は赤、後続打者による進塁は墨色で分ける。 */}
      <g strokeWidth="1.6" strokeLinecap="round" fill="none">
        {[
          [36, 53, 53, 36],
          [53, 36, 36, 19],
          [36, 19, 19, 36],
          [19, 36, 36, 53]
        ].map(([x1, y1, x2, y2], index) => traveled(index + 1) ? (
          <line key={index} x1={x1} y1={y1} x2={x2} y2={y2}
            stroke={symbol && index < symbol.hitBases ? "#b84058" : "#263f52"} />
        ) : null)}
      </g>

      {/* 中央。アウト数・得点・残塁は同時に起こらないので同じ場所を使う */}
      {record?.outNumber ? (
        <text
          x="36"
          y="42"
          textAnchor="middle"
          className="fill-ink text-[15px]"
          style={{ fontFamily: "var(--font-mono)", letterSpacing: "-0.5px" }}
        >
          {"I".repeat(record.outNumber)}
        </text>
      ) : null}
      {reached === 4 ? <circle cx="36" cy="36" r="5" fill="none" stroke="#b84058" strokeWidth="1.4" /> : null}
      {record?.leftOnBase ? (
        <text x="36" y="44" textAnchor="middle" className="fill-ink text-[18px] italic">
          ℓ
        </text>
      ) : null}

      {/* 右下に守備番号・処理順。安打種別は赤い塁間線の本数で表す。 */}
      {record ? (
        <>
          <text
            x="51"
            y="59"
            textAnchor="middle"
            className="text-[12px]"
            textLength={symbol && symbol.text.length > 4 ? 34 : undefined}
            lengthAdjust="spacingAndGlyphs"
            style={{
              fontFamily: "var(--font-mono)",
              fill: "var(--color-ink)",
              stroke: "var(--color-surface)",
              strokeWidth: 2,
              paintOrder: "stroke"
            }}
          >
            {symbol?.reverseK ? <tspan style={{ unicodeBidi: "bidi-override", direction: "rtl" }}>ꓘ</tspan> : symbol?.text}
          </text>
          {symbol?.liner ? <line x1="43" y1="46" x2="59" y2="46" stroke="#263f52" strokeWidth="1.2" /> : null}
          {record.event.result === "infield_hit" ? <path d="M44 61 Q53 67 61 51" fill="none" stroke="#b84058" strokeWidth="1.2" /> : null}
          {record.event.result === "bunt_hit" ? <circle cx="51" cy="55" r="9" fill="none" stroke="#b84058" strokeWidth="1.1" /> : null}
          {symbol?.fly ? <path d="M43 48 Q51 41 59 48" fill="none" stroke="#263f52" strokeWidth="1.2" /> : null}
        </>
      ) : null}

      {/* 走塁の記号は、進んだ塁の区画に追記する。長い処理順は欄外にも残す。 */}
      {[2, 3, 4].map(base => {
        const notes = record?.notes?.filter(note => note.base === base) ?? [];
        const x = base === 2 ? 55 : 16;
        const y = base === 4 ? 52 : 12;
        return notes.slice(0, 2).map((note, index) => (
          <text key={`${base}-${index}`} x={x} y={y + index * 10} textAnchor="middle"
            fontSize="11" fill="#263f52" stroke="white" strokeWidth="1.5" paintOrder="stroke"
            textLength={note.text.length > 5 ? 30 : undefined} lengthAdjust="spacingAndGlyphs">
            {note.text.length > 8 ? note.text.split(" ")[0] : note.text}
          </text>
        ));
      })}

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
            <circle key={index} cx={6 + index * 7} cy={66} r="1.7" fill="var(--color-ink)" />
          ))
        : null}
    </svg>
  );
}

function describe(cellName: string, record: CellRecord, order: string) {
  return [
    cellName + order,
    describePlayEvent(record.event),
    baseWords[record.reached],
    record.notes?.map(note => note.text).join("、"),
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
  return (
    <div className={styles.scoreCell}>
      {(records.length ? records : [null]).map((record, index) => (
        <div className={styles.appearance} key={record?.event.id ?? "empty"}>
          <div className={styles.pitchColumn} aria-hidden="true" />
          <div className={styles.markColumn}>
            <DiamondMark
              record={record}
              label={record ? describe(cellName, record, records.length > 1 ? ` ${index + 1}打席目` : "") : null}
            />
            {record?.notes?.filter((note, index, notes) => note.base === 1 || note.text.length > 8 || notes.filter(previous => previous.base === note.base).indexOf(note) >= 2).map((note, noteIndex) => (
              <span className={styles.runnerNote} key={noteIndex}>{["", "一塁", "二塁", "三塁", "本塁"][note.base]} {note.text}</span>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function SummaryCell({ value }: { value: number }) {
  return <div className={styles.summary}>{value || ""}<span className="sr-only">{value === 0 ? "0" : ""}</span></div>;
}

const positionNumbers: Record<string, string> = {
  投手: "1", 捕手: "2", 一塁手: "3", 二塁手: "4", 三塁手: "5",
  遊撃手: "6", 左翼手: "7", 中堅手: "8", 右翼手: "9"
};

/**
 * 紙スコア風プレビュー。
 * これは入力UIではなく出力プレビューなので、罫線と記号の可読性を優先し装飾は足さない。
 */
export function PaperScorePreview(props: PaperScorePreviewProps) {
  return (
    <div className="space-y-6">
      {(["top", "bottom"] as const).map((half) => (
        <TeamPaperScore
          key={half}
          {...props}
          half={half}
          events={props.events.filter((event) => event.half === half)}
        />
      ))}
    </div>
  );
}

function TeamPaperScore({ events, innings, currentInning, currentHalf, half }: PaperScorePreviewProps & { half: Half }) {
  const { getPlayer, lineups, teams, openMember } = useMatch();
  const teamName = half === "top" ? teams.away.name : teams.home.name;
  const lineup = lineups[half];
  // 用紙は9回分の罫線を用意し、延長時は全記録が収まるまで増やす。
  const paperInnings = Array.from({ length: Math.max(9, innings.length) }, (_, index) => String(index + 1));
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

  const gridTemplateColumns = `34px 30px 136px 34px repeat(${paperInnings.length}, 68px) repeat(4, 30px)`;
  const minWidth = 234 + paperInnings.length * 68 + 120;

  return (
    <section aria-label={`${teamName}の紙スコア`}>
      <h3 className="mb-2 text-sm font-bold text-ink">
        {teamName}（{half === "top" ? "先攻・表" : "後攻・裏"}）
      </h3>
      {canScroll ? (
        <p className="mb-2 flex items-center gap-1.5 text-xs text-muted">
          <MoveHorizontal size={14} aria-hidden="true" />
          横にスクロールすると{paperInnings.length}回と成績欄まで見られます
        </p>
      ) : null}

      <div ref={scrollRef} className={styles.scroll} tabIndex={0} role="region" aria-label={`${teamName}のスコア用紙・横スクロール`}>
        <div className={styles.sheet} style={{ width: minWidth + 4 }}>
          <div className={styles.sheetHeader}>
            <span>チーム名 <strong>{teamName}</strong></span>
            <span>{half === "top" ? "先攻" : "後攻"}</span>
            <span>記録：暫定</span>
          </div>
        <div
          className={styles.grid}
          style={{ gridTemplateColumns }}
          role="group"
          aria-label={`${teamName}の打順ごとの打席結果プレビュー`}
        >
          {["守備", "打順", "選 手 名", "背番"].map((label) => (
            <div key={label} className={styles.columnHeader}>{label}</div>
          ))}
          {paperInnings.map((inning) => {
            const isCurrent = Number(inning) === currentInning && half === currentHalf;

            return (
              <div
                key={inning}
                className={styles.columnHeader}
                aria-current={isCurrent ? "true" : undefined}
              >
                {inning}
                {isCurrent ? <span className="sr-only">（現在のイニング）</span> : null}
              </div>
            );
          })}
          {["打数", "安打", "打点", "得点"].map((label) => (
            <div
              key={label}
              className={styles.columnHeader}
            >
              {label}
            </div>
          ))}

          {lineup.map((slot) => {
            const player = getPlayer(slot.playerId);
            const summary = buildPlayerSummary(events, player.id);

            return (
              <div key={player.id} className="contents">
                <div className={styles.rosterCell} aria-label={slot.position}>
                  <span>{positionNumbers[slot.position] ?? slot.position}</span>
                </div>
                <div className={`${styles.rosterCell} ${styles.order}`}><span>{slot.order}</span></div>
                <div className={`${styles.rosterCell} ${styles.playerName}`}><span><button type="button" className="hover:underline" aria-label={`${player.name}の成績を見る`} onClick={() => openMember(player.id)}>{player.name}</button></span></div>
                <div className={styles.rosterCell}><span>{player.number}</span></div>

                {paperInnings.map((inning) => (
                  <ScoreCell
                    key={`${player.id}-${inning}`}
                    cellName={`${inning}回${half === "top" ? "表" : "裏"} ${slot.order}番 ${player.name}`}
                    records={findPlateAppearances(events, player.id, Number(inning)).map((index) =>
                      buildCellRecord(events, index)
                    )}
                  />
                ))}

                <SummaryCell value={summary.atBats} />
                <SummaryCell value={summary.hits} />
                <SummaryCell value={summary.rbi} />
                <SummaryCell value={summary.runs} />
              </div>
            );
          })}
        </div>
        </div>
      </div>

      <p className="mt-2 text-xs leading-relaxed text-muted">
        左の細欄は投球経過、選手欄の下段は交代記入用です。未入力の情報は空欄で表示します。
        塁間の線は進塁、中央の I・II・III はアウト順、赤い○ は得点、ℓ は残塁、左下の点は打点を表します。安打は赤い塁間線と守備番号、フライは番号の上の弧、四球はB、死球はDBで表します。走塁は各塁の区画にS・CS・BK・WP・PB、失策はE、挟殺はR/Oで追記します。方向不明は「?」です。
      </p>
    </section>
  );
}
