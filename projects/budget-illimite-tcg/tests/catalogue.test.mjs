import test from "node:test";
import assert from "node:assert/strict";
import { CARDS, RARITIES } from "../data/cards.js";

test("49 cartes et identifiants uniques", () => {
  assert.equal(CARDS.length, 49);
  assert.equal(new Set(CARDS.map(card => card.id)).size, 49);
});
test("répartition conforme à l'archive source", () => {
  assert.deepEqual(Object.fromEntries(RARITIES.map(({ id }) =>
    [id, CARDS.filter(card => card.rarity === id).length])),
    { commune: 17, rare: 15, epique: 10, legendaire: 4, secrete: 3 });
});
test("aucun média ou source vidéo inventé", () => {
  for (const card of CARDS) {
    assert.equal(card.verification, "a-verifier");
    assert.equal(card.sourceUrl, null);
    assert.equal(card.imageUrl, null);
  }
});
test("identifiants valides et noms non vides", () => {
  for (const card of CARDS) {
    assert.match(card.id, /^[a-z0-9_]+$/);
    assert.ok(card.name.length > 0);
  }
});
