import { CARDS, RARITIES } from "./data/cards.js";
import { simulateBooster } from "./game/booster.js";

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
  byId("detailRarity").textContent = rarityLabels[card.rarity] + " · non vérifiée";
  byId("detailArt").style.borderColor = RARITIES.find(r => r.id === card.rarity).color;
  markButton.textContent = marked.has(card.id) ? "Retirer le repère" : "Marquer comme repérée";
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
  for (const card of cards) {
    const item = el("article", "booster-result rarity-" + card.rarity);
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
