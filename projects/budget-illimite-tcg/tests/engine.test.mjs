import test from "node:test";
import assert from "node:assert/strict";
import { CARDS } from "../data/cards.js";
import { createMatch, applyAction, legalActions, chooseAiAction, cardStats, validateDeck, MAX_ENERGY, WIN_KOS, suggestBalancedDeck, ARCHETYPES } from "../game/engine.js";

const playerDeck = ["standupper","matelas","rituels","fontaine","etalon","mouette","chemise","fauxbras"];
const aiDeck = ["costume","touriste","arnaque","regent","igne","otage","moules","entite"];

test("deck of exactly 8 unique catalogued cards is required", () => {
  assert.equal(validateDeck(playerDeck).valid, true);
  assert.equal(validateDeck(playerDeck.slice(1)).valid, false);
  assert.equal(validateDeck([...playerDeck.slice(0, 7), playerDeck[0]]).valid, false);
  assert.equal(validateDeck([...playerDeck.slice(0, 7), "made_up"]).valid, false);
  assert.equal(validateDeck(null).valid, false);
});

test("each card has positive finite prototype stats", () => {
  for (const { id } of CARDS) {
    const card = cardStats(id);
    assert.ok(card.maxHp > card.quick);
    assert.ok(card.quick > 0 && card.burst > card.quick);
    assert.ok(card.focusGuard > 0);
  }
});

test("same seed and decks reproduce exactly the same match", () => {
  const a = createMatch({ playerDeck, aiDeck, seed: 2026 });
  const b = createMatch({ playerDeck, aiDeck, seed: 2026 });
  assert.deepEqual(a, b);
  assert.equal(a.sides.player.active.hp, cardStats(a.sides.player.active.id).maxHp);
  assert.equal(a.sides.ai.bench.length, 2);
});

test("illegal actions do not mutate a match", () => {
  const original = createMatch({ playerDeck, aiDeck, seed: 42 });
  const before = JSON.stringify(original);
  assert.throws(() => applyAction(original, "ai", { type: "quick" }), /interdite/);
  assert.throws(() => applyAction(original, "player", { type: "burst" }), /interdite/);
  assert.throws(() => applyAction(original, "player", { type: "swap", index: 100 }), /interdite/);
  assert.equal(JSON.stringify(original), before);
});

test("focus and attacks respect turn order, bounds and immutability", () => {
  const initial = createMatch({ playerDeck, aiDeck, seed: 3 });
  const focused = applyAction(initial, "player", { type: "focus" });
  assert.equal(initial.sides.player.energy, 1);
  assert.equal(focused.sides.player.energy, 3);
  assert.ok(focused.sides.player.guard >= 14);
  assert.equal(focused.turn, "ai");
  assert.equal(focused.sides.ai.energy, 2);
  const afterAi = applyAction(focused, "ai", { type: "quick" });
  assert.equal(afterAi.turn, "player");
  assert.equal(afterAi.round, 2);
  assert.ok(afterAi.sides.player.energy <= MAX_ENERGY);
  const power = applyAction(afterAi, "player", { type: "burst" });
  assert.equal(power.sides.player.energy >= 0, true);
  assert.equal(power.version, initial.version + 3);
});

test("swap preserves hit points and uses exactly one turn", () => {
  const start = createMatch({ playerDeck, aiDeck, seed: 9 });
  const active = start.sides.player.active.id, bench = start.sides.player.bench[0].id;
  const next = applyAction(start, "player", { type: "swap", index: 0 });
  assert.equal(next.sides.player.active.id, bench);
  assert.equal(next.sides.player.bench[0].id, active);
  assert.equal(next.turn, "ai");
});

test("100 deterministic complete matches terminate with three knockouts", () => {
  for (let seed = 1; seed <= 100; seed++) {
    let state = createMatch({ playerDeck, aiDeck, seed });
    let count = 0;
    while (!state.winner && count < 120) {
      const side = state.turn;
      const choices = legalActions(state, side);
      assert.ok(choices.length > 0);
      const choice = side === "ai" ? chooseAiAction(state) :
        choices.find(option => option.type === "burst") || choices.find(option => option.type === "quick");
      state = applyAction(state, side, choice);
      for (const s of Object.values(state.sides)) {
        assert.ok(s.energy >= 0 && s.energy <= MAX_ENERGY);
        assert.ok(s.guard >= 0 && s.guard <= 35);
        assert.ok(s.active === null || s.active.hp > 0);
      }
      count++;
    }
    assert.ok(state.winner, "seed " + seed + " did not terminate");
    assert.equal(state.sides[state.winner].knockouts, WIN_KOS);
    assert.equal(state.turn, null);
    assert.deepEqual(legalActions(state, "player"), []);
  }
});

test("suggestion de deck : deux cartes de chaque rôle et résultats reproductibles", () => {
  const deck = suggestBalancedDeck();
  assert.equal(validateDeck(deck).valid, true);
  assert.deepEqual(deck, suggestBalancedDeck());
  for (const role of ARCHETYPES) {
    assert.equal(deck.filter(id => cardStats(id).role === role).length, 2);
  }
});
