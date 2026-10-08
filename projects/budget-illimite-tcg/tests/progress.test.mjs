import test from "node:test";
import assert from "node:assert/strict";
import { createMatch, legalActions, applyAction, chooseAiAction, AI_DIFFICULTIES } from "../game/engine.js";
import { emptySoloProgress, normalizeSoloProgress, earnedSoloBadges, recordSoloResult } from "../game/progress.js";

const playerDeck = ["standupper","matelas","rituels","fontaine","etalon","mouette","chemise","fauxbras"];
const aiDeck = ["costume","touriste","arnaque","regent","igne","otage","moules","entite"];

function completeMatch(seed = 1, level = "normal") {
  let match = createMatch({ playerDeck, aiDeck, seed });
  let n = 0;
  while (!match.winner && n++ < 130) {
    const actions = legalActions(match, match.turn);
    const pick = match.turn === "ai" ? chooseAiAction(match, level) :
      actions.find(a => a.type === "burst") || actions.find(a => a.type === "quick");
    match = applyAction(match, match.turn, pick);
  }
  assert.ok(match.winner, "Partie non terminée : seed " + seed);
  return match;
}

test("progression vide cohérente et versionnée", () => {
  const p = emptySoloProgress();
  assert.equal(p.played, 0);
  assert.equal(p.wins, 0);
  assert.deepEqual(earnedSoloBadges(p), []);
  assert.deepEqual(normalizeSoloProgress(null), p);
  assert.deepEqual(normalizeSoloProgress({ version: 0 }), p);
});

test("progression malformée ignorée sans planter l'interface", () => {
  const defaults = emptySoloProgress();
  assert.deepEqual(normalizeSoloProgress({ ...defaults, wins: NaN }), defaults);
  assert.deepEqual(normalizeSoloProgress({ ...defaults, played: 999 }), defaults);
  assert.deepEqual(normalizeSoloProgress({ ...defaults, bestStreak: -1 }), defaults);
});

test("un résultat fait avancer les compteurs et débloque la première médaille", () => {
  const match = completeMatch(1, "decouverte");
  const { progress, unlocked } = recordSoloResult(emptySoloProgress(), match);
  assert.equal(progress.played, 1);
  assert.equal(progress.wins + progress.losses, 1);
  assert.equal(progress.totalKOs, match.sides.player.knockouts);
  assert.equal(progress.totalActions, match.version - 1);
  assert.ok(unlocked.some(b => b.id === "premier_duel"));
  assert.throws(() => recordSoloResult(progress, createMatch({ playerDeck, aiDeck })), /inachevée/);
});

test("série de trois victoires et remise à zéro après défaite", () => {
  const won = { winner: "player", sides: { player: { knockouts: 3 } }, version: 23 };
  const lost = { winner: "ai", sides: { player: { knockouts: 2 } }, version: 26 };
  let p = emptySoloProgress();
  for (let i = 0; i < 3; i++) p = recordSoloResult(p, won).progress;
  assert.equal(p.streak, 3);
  assert.equal(p.bestStreak, 3);
  assert.ok(earnedSoloBadges(p).some(b => b.id === "serie"));
  p = recordSoloResult(p, lost).progress;
  assert.equal(p.streak, 0);
  assert.equal(p.bestStreak, 3);
  assert.equal(p.wins, 3);
  assert.equal(p.losses, 1);
});

test("trois difficultés de Billy : choix permis et parties finies", () => {
  assert.deepEqual(AI_DIFFICULTIES, ["decouverte", "normal", "expert"]);
  for (const difficulty of AI_DIFFICULTIES) {
    for (let seed = 1; seed <= 30; seed++) {
      let m = createMatch({ playerDeck, aiDeck, seed });
      const saved = JSON.stringify(m);
      const player = legalActions(m, "player")[0];
      m = applyAction(m, "player", player);
      const beforeAiChoice = JSON.stringify(m);
      const choice = chooseAiAction(m, difficulty);
      assert.equal(JSON.stringify(m), beforeAiChoice, "AI mutates state");
      assert.ok(legalActions(m, "ai").some(a =>
        a.type === choice.type && (a.type !== "swap" || a.index === choice.index)));
      assert.ok(saved.length > 0);
      assert.equal(completeMatch(seed, difficulty).winner !== null, true);
    }
  }
  const m = createMatch({ playerDeck, aiDeck });
  assert.throws(() => chooseAiAction(m, "inconnue"), /inconnue/);
});
