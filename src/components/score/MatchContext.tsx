"use client";
import { createContext, useContext } from "react";
import { getPlayer, lineups, teams } from "@/lib/score-data";
import type { Match } from "@/lib/scorebook";

export const MatchContext = createContext<{
  getPlayer: typeof getPlayer;
  lineups: Match["lineups"];
  teams: Match["teams"];
  openMember: (id: string) => void;
}>({ getPlayer, lineups, teams, openMember: () => {} });
export const useMatch = () => useContext(MatchContext);
