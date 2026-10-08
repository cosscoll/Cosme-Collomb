/**
 * Audit d'équilibrage reproductible : confrontations solo hors navigateur.
 * Usage: node scripts/balance-report.mjs [N] (défaut: 200 graines par combinaison)
 *
 * Les résultats mesurent seulement des stratégies algorithmiques simplifiées :
 * ils ne sont PAS des données de tests avec des joueurs humains.
 */
import { CARDS } from "../data/cards.js";
import {
  AI_DIFFICULTIES, createMatch, legalActions, applyAction,
  chooseAiAction, cardStats
} from "../game/engine.js";

const count = Number(process.argv[2] || 200);
if (!Number.isSafeInteger(count) || count < 1 || count > 10000) {
  throw new Error("Le nombre de parties doit être un entier entre 1 et 10 000.");
}

const ids = CARDS.map(c => c.id);

const strategies = {
  offensive(match, options) {
    return options.find(a => a.type === "burst") || options.find(a => a.type === "quick");
  },
  prudente(match, options) {
    const own = match.sides.player;
    const enemy = match.sides.ai;
    const foeStats = cardStats(enemy.active.id);
    const stats = cardStats(own.active.id);
    const endangered = own.active.hp + own.guard <= foeStats.burst;
    if (endangered) {
      const safeSwap = options.find(a => a.type === "swap" &&
        own.bench[a.index].hp > own.active.hp + 30);
      if (safeSwap) return safeSwap;
    }
    if (own.energy >= 2 && (stats.burst >= enemy.active.hp + enemy.guard ||
      own.energy >= 3 || match.round % 3 === 0)) return { type: "burst" };
    if (own.energy < 2 && own.guard < 8 && match.round % 3 === 1) {
      return { type: "focus" };
    }
    return { type: "quick" };
  },
  apprentissage(match, options) {
    if (match.round % 4 === 0 && options.some(a => a.type === "focus")) return { type: "focus" };
    return { type: "quick" };
  }
};

function uniqueDeck(offset) {
  const rotated = [...ids.slice(offset), ...ids.slice(0, offset)];
  return rotated.slice(0, 8);
}

console.log("Rapport de simulation solo — " + count + " graines par couple difficulté / stratégie");
console.log("Attention : stratégies artificielles, pas statistiques réelles de joueurs.");
console.log("");

let failures = 0;
for (const difficulty of AI_DIFFICULTIES) {
  for (const [strategyName, choosePlayer] of Object.entries(strategies)) {
    let playerWins = 0, aiWins = 0, totalActions = 0;
    for (let seed = 1; seed <= count; seed++) {
      const playerDeck = uniqueDeck((seed * 11) % ids.length);
      const aiDeck = uniqueDeck(((seed * 11) + 16) % ids.length);
      let match = createMatch({ playerDeck, aiDeck, seed });
      let actionCount = 0;
      while (!match.winner && actionCount < 180) {
        const actor = match.turn;
        const legal = legalActions(match, actor);
        const choice = actor === "ai"
          ? chooseAiAction(match, difficulty)
          : choosePlayer(match, legal);
        if (!legal.some(a => a.type === choice?.type &&
          (a.type !== "swap" || a.index === choice.index))) {
          throw new Error("Action illégale : " + difficulty + " seed=" + seed);
        }
        match = applyAction(match, actor, choice);
        actionCount++;
      }
      if (!match.winner) {
        failures++;
        continue;
      }
      if (match.winner === "player") playerWins++;
      else aiWins++;
      totalActions += actionCount;
    }
    const playerPercent = ((100 * playerWins) / count).toFixed(1) + "%";
    const turns = (totalActions / count).toFixed(1);
    console.log([
      difficulty.padEnd(12),
      strategyName.padEnd(14),
      "joueur " + String(playerWins).padStart(4) + "/" + count,
      "(" + playerPercent.padStart(6) + ")",
      "Billy " + String(aiWins).padStart(4),
      "actions moy. " + turns
    ].join("  "));
  }
}
console.log("\nParties inachevées : " + failures);
if (failures) process.exitCode = 1;
