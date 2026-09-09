import type { GameState, LineupSlot, Player, PlateAppearanceResult } from "./types";

export const players: Player[] = [
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

export const lineup: LineupSlot[] = players.map((player, index) => ({
  order: index + 1,
  playerId: player.id,
  position: player.position
}));

export const resultLabels: Record<PlateAppearanceResult, { label: string; notation: string }> = {
  single: { label: "単打", notation: "1B" },
  double: { label: "二塁打", notation: "2B" },
  triple: { label: "三塁打", notation: "3B" },
  home_run: { label: "本塁打", notation: "HR" },
  walk: { label: "四球", notation: "BB" },
  hit_by_pitch: { label: "死球", notation: "HBP" },
  strikeout: { label: "三振", notation: "K" },
  groundout: { label: "ゴロアウト", notation: "5-3" },
  flyout: { label: "フライアウト", notation: "F8" },
  error: { label: "失策出塁", notation: "E5" },
  sacrifice: { label: "犠打", notation: "SAC" }
};

export const initialGameState: GameState = {
  inning: 1,
  half: "top",
  outs: 0,
  battingOrderIndex: 0,
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
