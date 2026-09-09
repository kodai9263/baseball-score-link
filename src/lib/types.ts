export type Half = "top" | "bottom";

export type GameStatus = "provisional" | "confirmed";

export type Base = "first" | "second" | "third";

export type PlateAppearanceResult =
  | "single"
  | "double"
  | "triple"
  | "home_run"
  | "walk"
  | "hit_by_pitch"
  | "strikeout"
  | "groundout"
  | "flyout"
  | "error"
  | "sacrifice";

export type Player = {
  id: string;
  number: number;
  name: string;
  grade: string;
  position: string;
  bats: "右" | "左" | "両";
  throws: "右" | "左";
};

export type LineupSlot = {
  order: number;
  playerId: string;
  position: string;
};

export type RunnerState = {
  first: string | null;
  second: string | null;
  third: string | null;
};

export type PlayEvent = {
  id: string;
  inning: number;
  half: Half;
  batterId: string;
  result: PlateAppearanceResult;
  notation: string;
  rbi: number;
  outsAdded: number;
  runsScored: string[];
  basesAfter: RunnerState;
  scoringStatus: GameStatus;
};

export type GameState = {
  inning: number;
  half: Half;
  outs: number;
  battingOrderIndex: Record<Half, number>;
  homeScore: number;
  awayScore: number;
  bases: RunnerState;
  events: PlayEvent[];
  status: GameStatus;
};
