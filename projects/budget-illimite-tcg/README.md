# Budget Illimité — TCG Thomas Deseur

**Prototype non officiel et expérimental** d'un jeu de cartes à collectionner inspiré d'apparitions, costumes et déguisements de Thomas Deseur. Ce projet n'est affilié à aucun créateur cité.

## Ce qui fonctionne actuellement

- Catalogue interactif des **49 identifiants de cartes** extraits du code de booster remis (17 communes, 15 rares, 10 épiques, 4 légendaires, 3 secrètes).
- Filtres, recherche, fiches de cartes et suivi de documentation sauvegardé localement.
- Atelier de deck : sélection de **8 cartes distinctes**, deck de départ, suppression et sauvegarde locale.
- **Mode solo jouable contre Billy** : 3 KO pour gagner, énergie, PV, capacités spéciales, protection, remplacement après KO et changements de cartes en réserve.
- Quatre archétypes de combat aux statistiques **provisoires** et équilibrées indépendamment de la rareté.
- Simulateur de booster **sans gain réel**, 5 cartes dont la dernière est au minimum rare.
- Tests catalogue / boosters / moteur + CI GitHub Actions dans `.github/workflows/budget-illimite-tcg-tests.yml`.

### Exécuter sur son ordinateur

Depuis `projects/budget-illimite-tcg/` :

```bash
python3 -m http.server 8000
# ou un autre serveur statique HTTP
```

Ouvrir ensuite `http://localhost:8000`. Il n'y a pas d'installation JS requise pour visualiser le jeu.

### Vérifier le moteur

```bash
npm test
```

Node.js 22 recommandé. `npm test` utilise `node --test` ; aucun paquet NPM n'est requis.

## Structure

```text
index.html                       Interface de collection, deck, arène, boosters
styles.css                       Identité visuelle responsive
app.js                           Logique d'interface / mode solo
data/cards.js                    49 identifiants et raretés, sources à vérifier
game/engine.js                   Moteur solo déterministe + IA
game/booster.js                  Simulation de tirage, sans économie réelle
tests/*.test.mjs                 Tests moteur, booster et données
security/restrict_booster_rpc.sql Proposition de durcissement, NON APPLIQUÉE
docs/AUDIT_ET_FEUILLE_DE_ROUTE.md Audit de sécurité et plan de travail
docs/REGLES_DU_PROTOTYPE.md      Règles du mode solo
```

## Attention : deux moteurs différents

Le moteur solo `game/engine.js` est un **nouveau prototype indépendant**. L'archive d'origine mentionnait `engine.js` mais ne le contenait pas, pas plus que le site d'origine ou les migrations initiales. **Ce nouveau moteur ne doit pas être importé tel quel dans les anciennes Edge Functions PvP** : les signatures et règles doivent d'abord être réconciliées.

Les noms du catalogue sont des libellés provisoires dérivés des IDs. Aucune référence vidéo ni photographie n'a été inventée ou validée. Les statistiques de combat affichées sont temporaires et ne reflètent pas une recherche sur Thomas Deseur.

### Ce qui n'est PAS prêt

- Pas de connexion à Supabase (aucun projet lié accessible lors du contrôle).
- Pas de vrais comptes, PvP, ELO, économie en ligne, propriété des cartes ni échanges.
- Pas de contenu média final autorisé ou vérifié.
- Pas de déploiement public ; les modifications sont isolées sur la branche `dev/thomas-deseur-tcg` du dépôt `cosscoll/Cosme-Collomb`, qui n'est pas le futur dépôt indépendant.

Ne jamais committer de `service_role`, mot de passe ou secrets dans GitHub. Ne pas déployer `security/restrict_booster_rpc.sql` sans vérifier les signatures et les politiques réelles de la base cible.

## Roadmap

1. Valider le solo sur navigateur desktop et mobile, tester l'équilibrage sur davantage de decks.
2. Retrouver les sources du projet initial et identifier précisément les mécaniques d'origine.
3. Documenter les 49 apparitions et leurs médias avec liens, dates et statut de droits.
4. Créer un dépôt autonome et un environnement Supabase de développement si les accès l'autorisent.
5. Construire le backend PvP/économie par transactions atomiques, RLS et tests de concurrence.
6. Ajouter onboarding, progression, classements, échanges, puis publier après validation.

Voir le document des règles et l'audit détaillé dans `docs/`.
