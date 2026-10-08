// Simulateur NON AUTORITATIF. Aucun booster acheté ni attribué.
// L'attribution réelle devra utiliser un tirage cryptographique côté serveur.
export const NORMAL_WEIGHTS = Object.freeze({
  commune: 55, rare: 27, epique: 12, legendaire: 4, secrete: 2,
});

export function weightedRarity(weights = NORMAL_WEIGHTS, random = Math.random) {
  const entries = Object.entries(weights).filter(([, weight]) => weight > 0);
  const total = entries.reduce((sum, [, weight]) => sum + weight, 0);
  if (!Number.isFinite(total) || total <= 0) throw new Error("Poids de rareté invalides");
  const roll = random();
  if (!Number.isFinite(roll) || roll < 0 || roll >= 1) throw new Error("Tirage hors limites");
  let limit = roll * total;
  for (const [rarity, weight] of entries) {
    if (limit < weight) return rarity;
    limit -= weight;
  }
  return entries.at(-1)[0];
}

export function simulateBooster(cards, random = Math.random) {
  const rareOrBetter = Object.fromEntries(
    Object.entries(NORMAL_WEIGHTS).filter(([name]) => name !== "commune")
  );
  return Array.from({ length: 5 }, (_, index) => {
    const rarity = weightedRarity(index === 4 ? rareOrBetter : NORMAL_WEIGHTS, random);
    const pool = cards.filter(card => card.rarity === rarity);
    if (pool.length === 0) throw new Error("Pool vide : " + rarity);
    const roll = random();
    if (!Number.isFinite(roll) || roll < 0 || roll >= 1) throw new Error("Tirage hors limites");
    return pool[Math.floor(roll * pool.length)];
  });
}
