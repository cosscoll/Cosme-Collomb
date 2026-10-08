import { CARDS, RARITIES } from "./data/cards.js";
import { simulateBooster } from "./game/booster.js";
import { createMatch, applyAction, legalActions, chooseAiAction, validateDeck, cardStats, DECK_SIZE, WIN_KOS, AI_DIFFICULTIES, suggestBalancedDeck } from "./game/engine.js";
import { emptySoloProgress, normalizeSoloProgress, SOLO_BADGES, earnedSoloBadges, recordSoloResult } from "./game/progress.js";

const byId = id => document.getElementById(id);
const search = byId("search");
const rarity = byId("rarity");
const onlyMarked = byId("onlyMarked");
const grid = byId("cardGrid");
const modal = byId("cardDialog");
const markButton = byId("markCard");
const rarityLabels = Object.fromEntries(RARITIES.map(r => [r.id, r.label]));
const STORAGE_KEY = "budget-illimite:documentation-markers:v1";
let selected = null;
let marked = new Set();

try {
  const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  if (Array.isArray(saved)) marked = new Set(saved.filter(id => CARDS.some(c => c.id === id)));
} catch {
  // Le catalogue reste consultable même lorsque le stockage est indisponible.
}

function saveMarked() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify([...marked])); } catch {}
}

function el(tag, cls, value) {
  const element = document.createElement(tag);
  if (cls) element.className = cls;
  if (value !== undefined) element.textContent = value;
  return element;
}

function openDetails(card) {
  selected = card;
  byId("detailTitle").textContent = card.name;
  byId("detailId").textContent = "ID technique : " + card.id;
  const demo = cardStats(card.id);
  byId("detailCombat").textContent = demo.role + " · " + demo.maxHp + " PV · " + demo.quick + " frappe · " + demo.burst + " capacité. " + demo.description + " Valeurs provisoires.";
  byId("detailRarity").textContent = rarityLabels[card.rarity] + " · non vérifiée";
  byId("detailArt").style.borderColor = RARITIES.find(r => r.id === card.rarity).color;
  markButton.textContent = marked.has(card.id) ? "Retirer le repère" : "Marquer comme repérée";
  refreshDeckDetailButton();
  if (typeof modal.showModal === "function") modal.showModal();
  else modal.setAttribute("open", "");
}

function createCard(card) {
  const tile = el("button", "tcg-card rarity-" + card.rarity);
  tile.type = "button";
  tile.setAttribute("aria-label", "Consulter " + card.name + " : " + rarityLabels[card.rarity]);

  const art = el("div", "tcg-art");
  art.append(el("span", "card-code", "BI / " + card.id.toUpperCase()));
  art.append(el("span", "question", "?"));

  const details = el("div", "card-details");
  details.append(el("span", "", rarityLabels[card.rarity]));
  details.append(el("strong", "", card.name));
  details.append(el("small", marked.has(card.id) ? "✓ Repérée localement" : "Origine à documenter"));
  if (marked.has(card.id)) details.lastChild.classList.add("marked");

  tile.append(art, details);
  tile.addEventListener("click", () => openDetails(card));
  return tile;
}

function render() {
  const query = search.value.trim().toLocaleLowerCase("fr");
  const chosenRarity = rarity.value;
  const results = CARDS.filter(card =>
    (chosenRarity === "all" || card.rarity === chosenRarity) &&
    (!onlyMarked.checked || marked.has(card.id)) &&
    (card.id.toLocaleLowerCase("fr").includes(query) || card.name.toLocaleLowerCase("fr").includes(query))
  );
  const fragment = document.createDocumentFragment();
  for (const card of results) fragment.append(createCard(card));
  grid.replaceChildren(fragment);

  byId("totalCards").textContent = String(CARDS.length);
  byId("verifiedCards").textContent = String(CARDS.filter(card => card.verification === "verifie").length);
  byId("markedCards").textContent = String(marked.size);
  byId("resultsCount").textContent = results.length + (results.length > 1 ? " cartes affichées" : " carte affichée");
  byId("emptyResults").classList.toggle("hidden", results.length !== 0);
}

markButton.addEventListener("click", () => {
  if (!selected) return;
  if (marked.has(selected.id)) marked.delete(selected.id);
  else marked.add(selected.id);
  saveMarked();
  render();
  markButton.textContent = marked.has(selected.id) ? "Retirer le repère" : "Marquer comme repérée";
});

search.addEventListener("input", render);
rarity.addEventListener("change", render);
onlyMarked.addEventListener("change", render);
render();

const boosterDialog = byId("boosterDialog");
function previewBooster() {
  const cards = simulateBooster(CARDS);
  const result = byId("boosterResults");
  const content = document.createDocumentFragment();
  for (const [index, card] of cards.entries()) {
    const item = el("article", "booster-result rarity-" + card.rarity);
    item.style.animationDelay = (index * 0.10) + "s";
    const art = el("div", "booster-result-art", "?");
    const kind = el("small", "", rarityLabels[card.rarity]);
    const name = el("strong", "", card.name);
    item.append(art, kind, name);
    content.append(item);
  }
  result.replaceChildren(content);
}
byId("simulateBooster").addEventListener("click", () => {
  previewBooster();
  if (typeof boosterDialog.showModal === "function") boosterDialog.showModal();
  else boosterDialog.setAttribute("open", "");
});
byId("rerollBooster").addEventListener("click", previewBooster);

/* ---- Prototype solo : atelier et affrontement local contre Billy ---- */
const DEFAULT_PLAYER_DECK = Object.freeze([
  "standupper", "matelas", "rituels", "fontaine", "etalon", "mouette", "chemise", "fauxbras"
]);
const DEFAULT_AI_DECK = Object.freeze([
  "costume", "touriste", "arnaque", "regent", "igne", "otage", "moules", "entite"
]);
const DECK_STORAGE_KEY = "budget-illimite:solo-deck:v1";
const cardById = new Map(CARDS.map(card => [card.id, card]));
let currentDeck = [...DEFAULT_PLAYER_DECK];
let match = null;
let matchEpoch = 0;
let matchResultRecorded = false;
let activeDifficulty = "normal";
const PROGRESS_STORAGE_KEY = "budget-illimite:solo-progress:v1";
const DIFFICULTY_STORAGE_KEY = "budget-illimite:solo-difficulty:v1";
let soloProgress = emptySoloProgress();

try {
  soloProgress = normalizeSoloProgress(JSON.parse(localStorage.getItem(PROGRESS_STORAGE_KEY) || "null"));
  const savedDifficulty = localStorage.getItem(DIFFICULTY_STORAGE_KEY);
  if (AI_DIFFICULTIES.includes(savedDifficulty)) byId("aiDifficulty").value = savedDifficulty;
} catch { /* browser storage is optional */ }

try {
  const savedDeck = JSON.parse(localStorage.getItem(DECK_STORAGE_KEY) || "null");
  if (Array.isArray(savedDeck) && savedDeck.every(id => cardById.has(id)) && new Set(savedDeck).size === savedDeck.length && savedDeck.length <= DECK_SIZE) {
    currentDeck = savedDeck;
  }
} catch { /* stockage optionnel */ }

function saveDeck() {
  try { localStorage.setItem(DECK_STORAGE_KEY, JSON.stringify(currentDeck)); } catch {}
}

function refreshDeckDetailButton() {
  const button = byId("toggleDeckCard");
  if (!selected) { button.disabled = true; return; }
  const isInDeck = currentDeck.includes(selected.id);
  button.disabled = !isInDeck && currentDeck.length >= DECK_SIZE;
  button.textContent = isInDeck ? "Retirer du deck" :
    currentDeck.length >= DECK_SIZE ? "Deck complet (retire une carte)" : "Ajouter au deck";
}

function renderDeck() {
  const list = byId("deckList");
  const fragment = document.createDocumentFragment();
  for (const id of currentDeck) {
    const card = cardById.get(id);
    const chip = el("div", "deck-chip rarity-" + card.rarity);
    chip.append(el("span", "deck-chip-symbol", "?"));
    const label = el("div", "deck-chip-text");
    label.append(el("strong", "", card.name), el("small", "", cardStats(id).role + " · " + rarityLabels[card.rarity]));
    const remove = el("button", "deck-remove", "×");
    remove.type = "button";
    remove.setAttribute("aria-label", "Retirer " + card.name + " du deck");
    remove.addEventListener("click", () => {
      currentDeck = currentDeck.filter(item => item !== id);
      saveDeck(); renderDeck();
    });
    chip.append(label, remove);
    fragment.append(chip);
  }
  for (let n = currentDeck.length; n < DECK_SIZE; n++) {
    const slot = el("div", "deck-empty", "+ Choisir une carte");
    fragment.append(slot);
  }
  list.replaceChildren(fragment);
  byId("deckCount").textContent = currentDeck.length + " / " + DECK_SIZE;
  const roleCounts = ["Assaut", "Rempart", "Tacticien", "Chaos"].map(role =>
    role + " : " + currentDeck.filter(id => cardStats(id).role === role).length
  );
  byId("deckComposition").textContent = "Composition du deck — " + roleCounts.join(" · ");
  byId("deckHint").textContent = validateDeck(currentDeck).valid ?
    "Deck prêt pour le mode solo. Les modifications ne changent pas une partie déjà commencée." :
    "Deck incomplet : ouvre les fiches du catalogue pour ajouter " + (DECK_SIZE - currentDeck.length) + " carte(s).";
  byId("startMatch").disabled = !validateDeck(currentDeck).valid;
  refreshDeckDetailButton();
}

byId("toggleDeckCard").addEventListener("click", () => {
  if (!selected) return;
  if (currentDeck.includes(selected.id)) {
    currentDeck = currentDeck.filter(id => id !== selected.id);
  } else if (currentDeck.length < DECK_SIZE) {
    currentDeck = [...currentDeck, selected.id];
  } else return;
  saveDeck(); renderDeck();
});
byId("balancedDeck").addEventListener("click", () => {
  currentDeck = suggestBalancedDeck();
  saveDeck();
  renderDeck();
});
byId("resetDeck").addEventListener("click", () => {
  currentDeck = [...DEFAULT_PLAYER_DECK];
  saveDeck(); renderDeck();
});

function unitLabel(id) { return cardById.get(id)?.name || id; }
function makeUnit(id, compact = false) {
  const stats = cardStats(id);
  const card = cardById.get(id);
  const tile = el("div", compact ? "mini-fighter rarity-" + card.rarity : "fighter-tile rarity-" + card.rarity);
  const visual = el("div", "fighter-visual", "?");
  const info = el("div", "fighter-info");
  info.append(el("small", "", stats.role), el("strong", "", unitLabel(id)));
  if (!compact) info.append(el("span", "", stats.description));
  tile.append(visual, info);
  return tile;
}
function renderSide(key) {
  const side = match?.sides[key] || null;
  const isPlayer = key === "player";
  const active = byId(key + "Active");
  active.replaceChildren();
  if (side?.active) active.append(makeUnit(side.active.id));
  else active.append(el("span", "arena-empty-note", isPlayer ? "Prépare ton deck pour jouer." : "L'adversaire arrive..."));
  byId(key + "Score").textContent = side ? side.knockouts + " / " + WIN_KOS + " KO" : "0 / " + WIN_KOS + " KO";
  if (side?.active) {
    const unit = cardStats(side.active.id);
    byId(key + "HpText").textContent = side.active.hp + " / " + unit.maxHp + " PV";
    byId(key + "HpBar").style.width = (side.active.hp / unit.maxHp * 100).toFixed(1) + "%";
    byId(key + "HpBar").setAttribute("aria-valuenow", side.active.hp);
    byId(key + "HpBar").setAttribute("aria-valuemax", unit.maxHp);
    byId(key + "Energy").textContent = side.energy + " / 5 énergie";
    byId(key + "Guard").textContent = side.guard ? "Protection : " + side.guard : "Aucune protection";
  } else {
    byId(key + "HpText").textContent = "— PV";
    byId(key + "HpBar").style.width = "0%";
    byId(key + "HpBar").setAttribute("aria-valuenow", 0);
    byId(key + "HpBar").setAttribute("aria-valuemax", 100);
    byId(key + "Energy").textContent = "— énergie";
    byId(key + "Guard").textContent = "Aucune protection";
  }
  const bench = byId(key + "Bench");
  const benchItems = document.createDocumentFragment();
  if (side) {
    for (let i = 0; i < side.bench.length; i++) {
      const unit = side.bench[i];
      const canSwap = isPlayer && !match.winner && match.turn === "player";
      if (canSwap) {
        const button = el("button", "bench-select");
        button.type = "button";
        button.setAttribute("aria-label", "Échanger avec " + unitLabel(unit.id) + " (utilise le tour)");
        button.append(makeUnit(unit.id, true));
        button.append(el("small", "", unit.hp + " PV · Échanger"));
        button.addEventListener("click", () => playerAction({ type: "swap", index: i }));
        benchItems.append(button);
      } else {
        const holder = el("div", "bench-static");
        holder.append(makeUnit(unit.id, true), el("small", "", unit.hp + " PV"));
        benchItems.append(holder);
      }
    }
  }
  if (!side || !side.bench.length) benchItems.append(el("small", "bench-message", "Aucune carte en réserve"));
  bench.replaceChildren(benchItems);
}

function renderSoloProgress() {
  byId("matchesPlayed").textContent = String(soloProgress.played);
  byId("matchesWon").textContent = String(soloProgress.wins);
  byId("matchesLost").textContent = String(soloProgress.losses);
  byId("bestStreak").textContent = String(soloProgress.bestStreak);
  const earned = new Set(earnedSoloBadges(soloProgress).map(item => item.id));
  const fragment = document.createDocumentFragment();
  for (const badge of SOLO_BADGES) {
    const unlocked = earned.has(badge.id);
    const item = el("div", unlocked ? "solo-badge achieved" : "solo-badge locked");
    const heading = el("strong", "", (unlocked ? "✓ " : "○ ") + badge.title);
    item.append(heading, el("small", "", badge.description));
    item.setAttribute("aria-label", (unlocked ? "Obtenu : " : "À débloquer : ") + badge.title);
    fragment.append(item);
  }
  byId("soloBadgeList").replaceChildren(fragment);
}

function saveSoloResultIfNeeded() {
  if (!match?.winner || matchResultRecorded) return;
  const result = recordSoloResult(soloProgress, match);
  soloProgress = result.progress;
  matchResultRecorded = true;
  try { localStorage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify(soloProgress)); } catch {}
  const notice = byId("battleResultNotice");
  notice.textContent = (match.winner === "player"
    ? "Victoire contre Billy !" : "Billy a gagné ce duel.") +
    " " + match.sides.player.knockouts + " KO réalisés." +
    (result.unlocked.length ? " Nouveaux défis : " + result.unlocked.map(b => b.title).join(", ") + "." : "");
  notice.classList.remove("hidden");
  renderSoloProgress();
}

function renderArena() {
  renderSide("player");
  renderSide("ai");
  byId("aiDifficulty").disabled = Boolean(match && !match.winner);
  const title = byId("turnInfo");
  const hint = byId("actionHint");
  const isReady = match && !match.winner && match.turn === "player";
  title.textContent = !match ? "Prêt pour le duel ?" : match.winner ?
    (match.winner === "player" ? "Victoire !" : "Billy remporte la partie") :
    match.turn === "player" ? "C'est ton tour" : "Billy réfléchit...";
  byId("roundInfo").textContent = match ? "Manche " + match.round : WIN_KOS + " KO pour gagner";
  hint.textContent = !match ? "Lance une partie pour activer les actions." :
    match.winner ? (match.winner === "player" ? "Bien joué ! Relance une partie pour rejouer." : "Retente ta chance contre Billy.") :
    isReady ? "Choisis une action ou échange avec une carte de réserve. Chaque action termine ton tour." : "L'adversaire prépare son action.";
  const options = isReady ? legalActions(match, "player") : [];
  for (const [buttonId, type] of [["quickAction","quick"],["burstAction","burst"],["focusAction","focus"]]) {
    byId(buttonId).disabled = !options.some(action => action.type === type);
  }
  if (match?.sides.player.active) {
    const stats = cardStats(match.sides.player.active.id);
    byId("quickDamage").textContent = stats.quick + " dégâts · gratuit";
    byId("burstDamage").textContent = stats.burst + (stats.role === "Chaos" && match.sides.player.active.hp * 2 <= stats.maxHp ? 10 : 0) + " dégâts · 2 énergies";
    byId("focusValue").textContent = "+2 énergie · +" + stats.focusGuard + " protection";
  } else {
    byId("quickDamage").textContent = "Attaque gratuite";
    byId("burstDamage").textContent = "2 énergies";
    byId("focusValue").textContent = "+2 énergie, +protection";
  }
  byId("startMatch").textContent = match ? "Recommencer le duel ↗" : "Lancer une partie ↗";
  const lines = document.createDocumentFragment();
  for (const message of [...(match?.history || [])].reverse().slice(0, 9)) lines.append(el("li", "", message));
  byId("battleLog").replaceChildren(lines);
}

function startSoloMatch() {
  const validation = validateDeck(currentDeck);
  if (!validation.valid) {
    byId("deckHint").textContent = validation.errors.join(" ");
    document.getElementById("deckbuilder").scrollIntoView({ behavior: "smooth" });
    return;
  }
  matchEpoch += 1;
  matchResultRecorded = false;
  const notice = byId("battleResultNotice");
  notice.classList.add("hidden");
  notice.textContent = "";
  const requested = byId("aiDifficulty").value;
  activeDifficulty = AI_DIFFICULTIES.includes(requested) ? requested : "normal";
  try { localStorage.setItem(DIFFICULTY_STORAGE_KEY, activeDifficulty); } catch {}
  match = createMatch({ playerDeck: currentDeck, aiDeck: DEFAULT_AI_DECK, seed: Date.now() + matchEpoch });
  renderArena();
}
function playerAction(action) {
  if (!match || match.winner || match.turn !== "player") return;
  try {
    match = applyAction(match, "player", action);
  } catch (error) {
    byId("actionHint").textContent = error.message;
    return;
  }
  saveSoloResultIfNeeded();
  renderArena();
  if (!match.winner && match.turn === "ai") {
    const scheduledFor = matchEpoch;
    window.setTimeout(() => {
      if (scheduledFor !== matchEpoch || !match || match.winner || match.turn !== "ai") return;
      try { match = applyAction(match, "ai", chooseAiAction(match, activeDifficulty)); }
      catch (error) {
        byId("actionHint").textContent = "Le tour de Billy a échoué : " + error.message;
        return;
      }
      saveSoloResultIfNeeded();
      renderArena();
    }, 450);
  }
}
byId("startMatch").addEventListener("click", startSoloMatch);
byId("quickAction").addEventListener("click", () => playerAction({ type: "quick" }));
byId("burstAction").addEventListener("click", () => playerAction({ type: "burst" }));
byId("focusAction").addEventListener("click", () => playerAction({ type: "focus" }));
renderDeck();
renderSoloProgress();
renderArena();
