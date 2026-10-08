// Transcription exacte des IDs et groupes de rareté présents dans open-booster-edge-function.ts.
// Les noms sont des libellés temporaires, non des apparitions vérifiées.
export const RARITIES = [
  { id: "commune", label: "Commune", color: "#9ca3af" },
  { id: "rare", label: "Rare", color: "#5cb7ff" },
  { id: "epique", label: "Épique", color: "#b28bff" },
  { id: "legendaire", label: "Légendaire", color: "#ffc45f" },
  { id: "secrete", label: "Secrète", color: "#ff79b5" },
];

const sourceIds = {
  commune: ["standupper","matelas","rituels","filtre","costume","touriste","polystyrene","amixem","sacrifice_capillaire","loft_quitte","moderateur","chiffon","301vues","oeufpoule","choipeau","tuktuk","soeur_amixem"],
  rare: ["fontaine","fauxbras","infiltre","arnaque","regent","noble","loft_rejoint","planque","sosies","goudurix","psy","popcorn","cape_invisibilite","judo","secret_youtube"],
  epique: ["etalon","igne","vilebrequin","otage","bgsi","jones","dictateur","vieux_contentieux","boycott","horcruxe"],
  legendaire: ["mouette","moules","crossover_mcfly","poudlard_titan"],
  secrete: ["chemise","entite","display_jdg"],
};

const labelFromId = id => id.replaceAll("_", " ").replace(/^\w/, c => c.toUpperCase());
export const CARDS = Object.freeze(
  RARITIES.flatMap(({ id: rarity }) => sourceIds[rarity].map((id, n) => ({
    id, rarity, name: labelFromId(id), collectionNumber: n + 1,
    verification: "a-verifier", sourceUrl: null, sourceTime: null,
    imageUrl: null, description: null, powers: null
  })))
);
if (CARDS.length !== 49 || new Set(CARDS.map(c => c.id)).size !== 49) {
  throw new Error("Catalogue incohérent : 49 identifiants uniques attendus.");
}
