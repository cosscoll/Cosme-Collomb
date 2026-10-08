import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

class FakeElement {
  constructor(tag = "div") {
    this.tagName = tag;
    this._text = "";
    this.children = [];
    this.value = "";
    this.checked = false;
    this.style = {};
    this.disabled = false;
    this.events = {};
    this.classList = { add() {}, remove() {}, toggle() { return false; } };
  }
  set textContent(text) { this._text = String(text); this.children = []; }
  get textContent() { return this._text; }
  append(...children) {
    for (const child of children) {
      if (child?.tagName === "fragment") this.children.push(...child.children);
      else this.children.push(child);
    }
  }
  replaceChildren(...children) { this.children = []; this.append(...children); }
  addEventListener(event, fn) { this.events[event] = fn; }
  setAttribute(name, value) { this[name] = value; }
  showModal() { this.open = true; }
  scrollIntoView() {}
  click() { return this.events.click?.(); }
}

test("solo UI: from card catalog and deck editing through a finished match", async () => {
  const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
  const ids = [...html.matchAll(/id="([^"]+)"/g)].map(match => match[1]);
  const elements = new Map(ids.map(id => [id, new FakeElement()]));
  elements.get("rarity").value = "all";
  elements.get("aiDifficulty").value = "normal";
  const get = id => {
    assert.ok(elements.has(id), "HTML element missing: " + id);
    return elements.get(id);
  };

  const timers = [];
  const database = new Map();
  globalThis.document = {
    getElementById: get,
    createElement: tag => new FakeElement(tag),
    createDocumentFragment: () => new FakeElement("fragment")
  };
  globalThis.window = { setTimeout: cb => { timers.push(cb); return timers.length; } };
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: key => database.get(key) ?? null,
      setItem: (key, value) => { database.set(key, value); }
    }
  });

  await import("../app.js");

  assert.equal(get("cardGrid").children.length, 49);
  assert.equal(get("deckCount").textContent, "8 / 8");
  get("cardGrid").children[0].click();
  assert.equal(get("cardDialog").open, true);
  assert.match(get("detailCombat").textContent, /PV/);

  get("toggleDeckCard").click();
  assert.equal(get("deckCount").textContent, "7 / 8");
  assert.equal(get("startMatch").disabled, true);
  get("resetDeck").click();
  assert.equal(get("deckCount").textContent, "8 / 8");
  assert.equal(get("startMatch").disabled, false);
  get("balancedDeck").click();
  assert.equal(get("deckCount").textContent, "8 / 8");
  assert.match(get("deckComposition").textContent, /Assaut : 2/);
  assert.match(get("deckComposition").textContent, /Rempart : 2/);
  assert.match(get("deckComposition").textContent, /Tacticien : 2/);
  assert.match(get("deckComposition").textContent, /Chaos : 2/);
  get("resetDeck").click();
  get("aiDifficulty").value = "decouverte";

  get("startMatch").click();
  assert.equal(get("aiDifficulty").disabled, true);
  assert.equal(get("turnInfo").textContent, "C'est ton tour");

  for (let step = 0; step < 120; step++) {
    const status = get("turnInfo").textContent;
    if (status === "Victoire !" || status === "Billy remporte la partie") break;
    if (status === "C'est ton tour") {
      get(get("burstAction").disabled ? "quickAction" : "burstAction").click();
    }
    if (timers.length) timers.shift()();
  }
  assert.ok(["Victoire !", "Billy remporte la partie"].includes(get("turnInfo").textContent));
  assert.ok(get("battleLog").children.length > 0);
  assert.equal(get("matchesPlayed").textContent, "1");
  assert.equal(Number(get("matchesWon").textContent) + Number(get("matchesLost").textContent), 1);
  assert.equal(get("aiDifficulty").disabled, false);
  assert.ok(get("battleResultNotice").textContent.length > 20);
  assert.equal(JSON.parse(database.get("budget-illimite:solo-progress:v1")).played, 1);

  get("startMatch").click();
  assert.equal(get("matchesPlayed").textContent, "1");
  assert.equal(get("turnInfo").textContent, "C'est ton tour");
  get("quickAction").click(); // Planifie le tour de Billy
  assert.ok(timers.length > 0);
  get("startMatch").click(); // Annule l'ancienne partie
  timers.shift()(); // L'ancien callback ne doit plus rien modifier
  assert.equal(get("turnInfo").textContent, "C'est ton tour");
  assert.equal(get("matchesPlayed").textContent, "1");
  get("simulateBooster").click();
  assert.equal(get("boosterResults").children.length, 5);
  assert.equal(database.get("budget-illimite:solo-difficulty:v1"), "decouverte");
  assert.equal(get("soloBadgeList").children.length, 6);
});
