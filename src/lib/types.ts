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
  | "sacrifice"
  | "infield_hit" | "bunt_hit" | "intentional_walk" | "dropped_third"
  | "foul_fly" | "lineout" | "fielders_choice" | "double_play"
  | "stolen_base" | "caught_stealing" | "balk" | "wild_pitch" | "passed_ball"
  | "runner_error" | "hit_error" | "tag_out" | "rundown";

export type Destination = Base | "home" | "out";
export type RunnerMovement = {
  playerId: string;
  from: Base | "batter";
  to: Destination;
  outOrder?: number;
  outAt?: Base | "home";
  scoredBeforeThirdOut?: boolean;
  reason?: string;
  via?: Base;
};
export type ThirdOutKind = "force" | "batter_before_first" | "tag" | "caught_fly";

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

export type FieldPosition = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

export type PlayDetails = {
  direction?: FieldPosition;
  errorFielder?: FieldPosition;
  fieldingSequence?: FieldPosition[];
};

export type PlayEvent = PlayDetails & {
  kind?: "plate" | "runner";
  movements?: RunnerMovement[];
  thirdOutKind?: ThirdOutKind;
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
