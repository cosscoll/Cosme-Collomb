import test from "node:test";
import assert from "node:assert/strict";
import { CARDS } from "../data/cards.js";
import { simulateBooster, weightedRarity } from "../game/booster.js";

test("booster de démonstration : cinq cartes valides", () => {
  const draw = simulateBooster(CARDS, () => 0);
  assert.equal(draw.length, 5);
  assert.ok(draw.every(card => CARDS.includes(card)));
  assert.equal(draw.at(-1).rarity, "rare");
});
test("cinquième carte jamais commune même au tirage maximal", () => {
  for (const n of [0, 0.1, 0.55, 0.82, 0.94, 0.99, 0.999999999]) {
    const draw = simulateBooster(CARDS, () => n);
    assert.notEqual(draw.at(-1).rarity, "commune");
  }
});
test("frontières de tirage gérées strictement", () => {
  assert.equal(weightedRarity(undefined, () => 0), "commune");
  assert.equal(weightedRarity(undefined, () => 0.99), "secrete");
  assert.throws(() => weightedRarity(undefined, () => 1), /limites/);
});
