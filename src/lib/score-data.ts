import type { GameState, Half, LineupSlot, Player, PlateAppearanceResult } from "./types";

const awayPlayers: Player[] = [
  { id: "p1", number: 10, name: "佐藤 湊", grade: "6年", position: "投手", bats: "右", throws: "右" },
  { id: "p2", number: 2, name: "高橋 蓮", grade: "6年", position: "捕手", bats: "右", throws: "右" },
  { id: "p3", number: 3, name: "田中 陽", grade: "5年", position: "一塁手", bats: "左", throws: "左" },
  { id: "p4", number: 4, name: "伊藤 蒼", grade: "5年", position: "二塁手", bats: "右", throws: "右" },
  { id: "p5", number: 5, name: "渡辺 樹", grade: "6年", position: "三塁手", bats: "右", throws: "右" },
  { id: "p6", number: 6, name: "山本 翔", grade: "6年", position: "遊撃手", bats: "右", throws: "右" },
  { id: "p7", number: 7, name: "中村 悠", grade: "5年", position: "左翼手", bats: "左", throws: "右" },
  { id: "p8", number: 8, name: "小林 颯", grade: "4年", position: "中堅手", bats: "右", throws: "右" },
  { id: "p9", number: 9, name: "加藤 海", grade: "5年", position: "右翼手", bats: "右", throws: "右" }
];

// 既存の選手IDは先攻側に残し、後攻側には別のIDを割り当てる。
const homePlayers: Player[] = awayPlayers.map((player, index) => ({
  ...player,
  id: `home-p${index + 1}`,
  name: `東台 選手${index + 1}`
}));

export const players: Player[] = [...awayPlayers, ...homePlayers];

const buildLineup = (roster: Player[]): LineupSlot[] => roster.map((player, index) => ({
  order: index + 1,
  playerId: player.id,
  position: player.position
}));

export const lineups: Record<Half, LineupSlot[]> = {
  top: buildLineup(awayPlayers),
  bottom: buildLineup(homePlayers)
};

export const getCurrentLineupSlot = (game: GameState): LineupSlot => {
  const lineup = lineups[game.half];
  return lineup[game.battingOrderIndex[game.half] % lineup.length];
};

export const resultLabels: Record<PlateAppearanceResult, { label: string; notation: string }> = {
  single: { label: "単打", notation: "1B" },
  double: { label: "二塁打", notation: "2B" },
  triple: { label: "三塁打", notation: "3B" },
  home_run: { label: "本塁打", notation: "HR" },
  walk: { label: "四球", notation: "BB" },
  hit_by_pitch: { label: "死球", notation: "HBP" },
  strikeout: { label: "三振", notation: "K" },
  groundout: { label: "ゴロアウト", notation: "GO" },
  flyout: { label: "フライアウト", notation: "FO" },
  error: { label: "失策出塁", notation: "E" },
  sacrifice: { label: "犠打", notation: "SAC" },
  infield_hit: { label: "内野安打", notation: "IH" },
  bunt_hit: { label: "バント安打", notation: "BH" },
  intentional_walk: { label: "申告敬遠", notation: "DIB" },
  dropped_third: { label: "振り逃げ", notation: "K" },
  foul_fly: { label: "ファウルフライ", notation: "FF" },
  lineout: { label: "ライナー", notation: "L" },
  fielders_choice: { label: "野手選択", notation: "FC" },
  double_play: { label: "併殺", notation: "DP" },
  stolen_base: { label: "盗塁", notation: "S" },
  caught_stealing: { label: "盗塁死", notation: "CS" },
  balk: { label: "ボーク", notation: "BK" },
  wild_pitch: { label: "ワイルドピッチ", notation: "WP" },
  passed_ball: { label: "パスボール", notation: "PB" },
  runner_error: { label: "失策による進塁", notation: "E" },
  hit_error: { label: "ワンヒットワンエラー", notation: "H+E" },
  tag_out: { label: "タッチアウト", notation: "TO" },
  rundown: { label: "挟殺プレイ", notation: "R/O" }
};

export const initialGameState: GameState = {
  inning: 1,
  half: "top",
  outs: 0,
  battingOrderIndex: { top: 0, bottom: 0 },
  homeScore: 0,
  awayScore: 0,
  bases: { first: null, second: null, third: null },
  events: [],
  status: "provisional"
};

export const getPlayer = (playerId: string): Player => {
  const player = players.find((item) => item.id === playerId);

  if (!player) {
    throw new Error(`Player not found: ${playerId}`);
  }

  return player;
};

/** 表示専用のサンプルチーム。試合ヘッダーの対戦カードに使う */
export const teams = {
  away: { name: "青葉ファイターズ", short: "青葉" },
  home: { name: "東台イーグルス", short: "東台" }
} as const;

/** 標準の回数。少年野球の多くはここで終わるので、得点がなくても常にこの数だけ列を出す */
export const regulationInnings = 6;

/**
 * 表示するイニングの並び。
 * 延長したときは現在の回まで伸ばす。伸ばさないと7回以降の得点が
 * 「計」にだけ乗り、各回の合計と食い違ってしまう。
 */
export const buildInningLabels = (currentInning: number): string[] =>
  Array.from({ length: Math.max(regulationInnings, currentInning) }, (_, index) => String(index + 1));

/**
 * 打席結果を意味で3群に分ける。
 * タブでは切り替えず同一画面に並べるので、頻出操作のタップ数は1回のまま変わらない。
 */
export const resultGroups: Array<{
  id: string;
  label: string;
  results: PlateAppearanceResult[];
}> = [
  { id: "hit", label: "安打", results: ["single", "double", "triple", "home_run"] },
  { id: "reach", label: "出塁", results: ["walk", "hit_by_pitch", "error"] },
  { id: "out", label: "アウト", results: ["strikeout", "groundout", "flyout", "sacrifice"] }
];


export const additionalResultGroups: { label: string; results: PlateAppearanceResult[] }[] = [
  { label: "追加の打席結果", results: ["infield_hit", "bunt_hit", "intentional_walk", "dropped_third", "foul_fly", "lineout", "fielders_choice", "double_play", "hit_error"] },
  { label: "走塁・投手（打席を進めない）", results: ["stolen_base", "caught_stealing", "balk", "wild_pitch", "passed_ball", "runner_error", "tag_out", "rundown"] }
];
