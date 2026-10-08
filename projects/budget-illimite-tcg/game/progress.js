/** Progression purement locale du prototype solo : ni compte ni monnaie virtuelle. */
export const SOLO_PROGRESS_VERSION = 1;
export const SOLO_BADGES = Object.freeze([
  { id: "premier_duel", title: "Premier duel", description: "Terminer une partie", check: p => p.played >= 1 },
  { id: "premiere_victoire", title: "Première victoire", description: "Gagner une partie", check: p => p.wins >= 1 },
  { id: "triple_ko", title: "Combattant", description: "Réussir 10 KO cumulés", check: p => p.totalKOs >= 10 },
  { id: "assidu", title: "Habitué de l'arène", description: "Terminer 10 parties", check: p => p.played >= 10 },
  { id: "serie", title: "Série de victoires", description: "Remporter 3 duels consécutifs", check: p => p.bestStreak >= 3 },
  { id: "veteran", title: "Vétéran", description: "Remporter 20 duels", check: p => p.wins >= 20 }
]);

export function emptySoloProgress() {
  return {
    version: SOLO_PROGRESS_VERSION, played: 0, wins: 0, losses: 0,
    streak: 0, bestStreak: 0, totalKOs: 0, totalActions: 0, lastOutcome: null
  };
}

export function normalizeSoloProgress(raw) {
  const empty = emptySoloProgress();
  if (!raw || typeof raw !== "object" || Array.isArray(raw) || raw.version !== SOLO_PROGRESS_VERSION) return empty;
  const copy = { ...empty };
  for (const name of ["played", "wins", "losses", "streak", "bestStreak", "totalKOs", "totalActions"]) {
    const value = raw[name];
    if (!Number.isSafeInteger(value) || value < 0 || value > 10000000) return empty;
    copy[name] = value;
  }
  if (copy.played !== copy.wins + copy.losses || copy.streak > copy.wins ||
      copy.bestStreak < copy.streak || copy.bestStreak > copy.wins ||
      copy.totalKOs > copy.played * 3) return empty;
  copy.lastOutcome = raw.lastOutcome === "victoire" || raw.lastOutcome === "defaite"
    ? raw.lastOutcome : null;
  return copy;
}

export function earnedSoloBadges(progress) {
  return SOLO_BADGES.filter(b => b.check(progress)).map(b => ({
    id: b.id, title: b.title, description: b.description
  }));
}

/** Call once per completed match. The UI must prevent duplicate recordings. */
export function recordSoloResult(previous, match) {
  if (!match || (match.winner !== "player" && match.winner !== "ai")) {
    throw new Error("Impossible d'enregistrer une partie inachevée.");
  }
  const p = normalizeSoloProgress(previous);
  const oldBadges = new Set(earnedSoloBadges(p).map(b => b.id));
  const won = match.winner === "player";
  const next = {
    ...p, played: p.played + 1, wins: p.wins + Number(won),
    losses: p.losses + Number(!won), streak: won ? p.streak + 1 : 0,
    totalKOs: p.totalKOs + match.sides.player.knockouts,
    totalActions: p.totalActions + Math.max(0, match.version - 1),
    lastOutcome: won ? "victoire" : "defaite"
  };
  next.bestStreak = Math.max(p.bestStreak, next.streak);
  return {
    progress: next,
    unlocked: earnedSoloBadges(next).filter(b => !oldBadges.has(b.id))
  };
}
