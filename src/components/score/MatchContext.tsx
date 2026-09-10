"use client";
import { createContext, useContext } from "react";
import { getPlayer, lineups, teams } from "@/lib/score-data";
import type { Match } from "@/lib/scorebook";
import type { LineupChange } from "@/lib/types";

export const MatchContext = createContext<{
  getPlayer: typeof getPlayer;
  lineups: Match["lineups"];
  teams: Match["teams"];
  changes: LineupChange[];
  openMember: (id: string) => void;
}>({ getPlayer, lineups, teams, changes: [], openMember: () => {} });
export const useMatch = () => useContext(MatchContext);
