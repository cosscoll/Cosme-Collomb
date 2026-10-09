# Transmission du Portfolio 3D à ChatGPT Work
**Date :** 9 octobre 2026  
**Priorité absolue :** navigation 3D immersive, sans demi-tour visible, sans téléportation ni traversée des parois.  
**État :** site public stable sur `main`; implémentation expérimentale des boucles unidirectionnelles sur `dev/forward-only-loops` NON VALIDÉE en navigateur.

## 1. Accès et références à utiliser

- GitHub : https://github.com/cosscoll/Cosme-Collomb
- Site public : https://cosscoll.github.io/Cosme-Collomb/
- Branche publique exploitable : `main`
- Branche de travail à reprendre : `dev/forward-only-loops`  
  https://github.com/cosscoll/Cosme-Collomb/tree/dev/forward-only-loops
- Dernier commit du code expérimental avant ce document : `020a5581c917498ae085d611b3c46bec035d4c1d`
- Dernier test de cette branche : https://github.com/cosscoll/Cosme-Collomb/actions/runs/37928972558
- Le dépôt est public. Vérifier les permissions GitHub effectives dans la session Work avant toute écriture. Ne pas demander à l'utilisateur de partager des secrets.

## 2. Intention non négociable de l'utilisateur

L'utilisateur veut explorer son Portfolio **depuis l'intérieur d'un tunnel 3D à la première personne**, avancer jusqu'à un carrefour physique contenant **huit** voies vers **huit** projets, choisir un chemin, parcourir une présentation narrative, continuer **dans le même sens** en décrivant une vraie boucle et revenir au **même carrefour avec les huit accès toujours présents**, y compris le projet qui vient d'être visité.

Critères impératifs :
- **Aucun demi-tour ou rotation de 180°** : le regard doit aller dans le sens réel de progression, même dans les transitions de page. Ne jamais régler ce problème en animant plus lentement un mouvement arrière.
- **Aucune téléportation** : position, orientation, vitesse et scène 3D doivent rester continues au passage d'un carrefour, d'une transition et d'une page.
- **Aucune traversée de paroi** : la caméra reste à l'intérieur du tunnel, et les ouvertures des carrefours sont réellement dégagées. Aucune vue extérieure/plongée; parois opaques.
- Chaque projet a un **aller et un retour physiquement différents**, reliés par une courbe suffisamment large. Pas d'aller-retour en inversant le paramètre de spline.
- La fin d'un projet revient au **même** carrefour avec les **huit chemins**, sans tunnel bouché, sans quatrième interface fictive, sans désactivation du chemin visité.
- Qualité et fluidité : limiter les ralentissements GPU, les allocations par frame, les changements brusques de FOV, les décalages entre affichage et caméra, notamment mobile.
- Le scroll peut piloter le récit, mais ne doit **jamais provoquer de retour physique en arrière** dans le tunnel. Définir un comportement cohérent si l'utilisateur remonte la page.
- Préserver la navigation hors projets (accueil, parcours, contact), le contenu des fiches, le responsive et l'accessibilité.

## 3. Les huit projets actuels

1. Ouvertures d'échecs en 3D — `Chess-Openings`.
2. Probabilités Hold'em — `PokerStats`.
3. Brasserie virtuelle — `MyBeer`.
4. EuroRare — `Is-my-coin-rare-`.
5. Plateforme IFSI Bérénice — `Berenice.ifsy`.
6. IAgile, formations à l'IA — `IAgile`, vitrine en pré-lancement; ne pas exposer les cours réservés.
7. **TCG Deseur** — `TCG-Thomas-Deseur`, ouverture de boosters et collection; mode local de démonstration, comptes officiels non garantis. Certains textes du Portfolio contiennent encore l'ancien titre **« Budget Illimité »** : corriger cette incohérence avec le nom demandé `TCG Deseur` si nécessaire.
8. UnCoupDePouce — mise en relation particuliers/professionnels BTP, sans commission. **Ne pas inventer de dépôt ou d'URL publique** : les liens sont vides dans `src/data/projects.js`.

Les données des fiches : `src/data/projects.js`, récits : `src/data/projectStories.js`. Le nombre de branches découle des données, non d'un nombre fixe en dur.

## 4. Architecture et fichiers à examiner d'abord

- `src/scene/geometry.js` : coordonnées et splines `TRUNK`, `BRANCHES`, `CHILDREN`, `PATHS`, `PROJECT_HUBS`, `PROJECT_FORK_POSITION`, `PROJECT_FORK_FOCUS`, `createSkin`, `shellSpans` et paramètres des huit corridors. **Travail actuel ici :** chaque enfant décrit une boucle géométrique avec piste de retour distincte.
- `src/scene/transit.js` : `routeInfo`, `scrollT`, `junctionFor`, `arrivalT`, `sampleTransit`, `transitPoint` et logique de transition du carrefour. Attention aux paramètres qui diminuent, aux départs hors du carrefour, et aux modes `detail` et `projects`.
- `src/components/World.jsx` : `CameraFlight`, `Shell`, `BuildingBranch`, rotation/orientation, position caméra et visibilité des murs. Les rotations dépendent encore de `blendHeading` et du sens des transitions; vérifier chaque cas.
- `src/scene/cameraMotion.js` : filtrage du scroll et limite de déplacement physique par frame.
- `src/App.jsx` : `ProjectDetail` et sa fin automatique (`onJourneyFinished`), `beginTrip`, changement de route au milestone et retour au carrefour.
- `src/styles/rebuilt.css` : carrefour responsive / superposition sur WebGL.
- `tests/geometry.test.js`, `tests/transit.test.js`, `tests/cameraMotion.test.js`, `tests/navigation.test.js`, `tests/browser-smoke.mjs` : tests actuels; ajouter des tests de non-retour sans affaiblir les précédents.

`package.json` : Vite + React 18, Three.js et react-three-fiber. GitHub Pages sert des fichiers Vite compilés sous `/Cosme-Collomb/` et le site est routé par hash. La CI est `.github/workflows/deploy.yml`, la synchronisation `scripts/sync-published-root.sh`. Construire le site avec l'entrée Vite prévue : `cp site/index.source.html index.html` avant `npm run build` si la racine contient l'ancienne page compilée.

## 5. Où le travail s'est arrêté — état rigoureusement vérifié

Le site `main` est le **dernier résultat public fonctionnel**, mais il peut encore faire un demi-tour visible. Les précédentes optimisations 3D sur `main` incluent mise en cache des géométries GPU, matériaux allégés, limitation DPR et déplacements caméra, parois de carrefour ouvertes.

La branche `dev/forward-only-loops` ajoute :
- Huit splines enfants formant chacun une boucle physique allant du carrefour à une extrémité puis revenant par une autre piste.
- `scrollT(detail)` croissant, au lieu de diminuer après ~70 % de progression.
- Suppression de l'inversion délibérée de la direction caméra à la fin des récits.
- Révision de `PROJECT_HUBS` pour éviter que la recherche de point le plus proche sélectionne l'arrivée de la boucle au lieu du départ.
- Modifications des tests de géométrie et des raccords.

**Cette branche ne doit PAS être fusionnée en `main` telle quelle.**
Dernier GitHub Actions (37928972558) : tests géométriques + build réussis, **`npm run test:browser` en échec**. Le test entre bien dans le premier projet, mais attend ensuite pendant 60 secondes l'apparition du titre `Huit projets` après le retour automatique (tests/browser-smoke.mjs, autour de la ligne 188). Le retour automatique au carrefour / la durée de la transition / la navigation dirigée ne sont donc pas réglés. Ne pas prétendre que cette boucle est publiée en production ou que tous les tests réussissent. D'autres transitions restent à auditer, notamment accès aux pages hors projets et clic sur l'en-tête depuis n'importe quelle position.

**Piste technique à explorer :** les trajets de projet sont devenus beaucoup plus longs. `CameraFlight` plafonne le déplacement en mètres par frame, puis divise l'incrément de progression jusqu'à dix fois; `sampleTransit` impose parfois de rejoindre un embranchement situé en arrière sur la spline, et `arrivalT(projects)` utilise un point de guet placé avant le carrefour. Un vrai graphe orienté, avec un retour unidirectionnel vers un espace de sortie/observation, sera probablement nécessaire. Ceci est une hypothèse d'analyse, pas une cause entièrement démontrée.

## 6. Travail à faire par Work, dans cet ordre

1. Vérifier l'état live, les SHA et les workflows, parcourir le code réel et reproduire l'échec navigateur de `dev/forward-only-loops`. Ne pas supposer que les états sont inchangés.
2. Concevoir un parcours **orienté** avec, pour chaque projet, une boucle continue arrivée → récit → retour au même carrefour. Les transferts depuis n'importe quelle page ou n'importe quelle position de scroll doivent suivre des segments physiques dans le sens d'avancement. Adapter le point d'observation du carrefour si nécessaire.
3. Corriger définitivement la caméra : orientation alignée sur vitesse/tangente avant, continuité des quaternions et du FOV, pas de slerp vers une direction arrière. Éviter les points `lookAt` confondus avec la position de la caméra.
4. Faire coïncider les tunnels visibles, les joints et le mouvement. Éliminer toute traversée de paroi, collision de branches, trou, raccord non construit ou disparition du décor. Conserver les huit choix accessibles.
5. Optimiser sans dégrader le rendu : éviter géométrie/allocation/recalcul de layout par frame, tester GPU lent/mobile et fallback.
6. Tester `npm run test:geometry`, `node --test tests/prototype-v2-geometry.test.mjs`, `npm run build`, `npm run test:browser`, `node tests/prototype-3d-smoke.mjs` et, si utile, audit navigateur complet des huit projets. Ajouter des vérifications pour les 8 boucles, le vecteur vitesse produit scalaire avec la direction du regard, les jonctions, les allers-retours, les transitions de pages, les marches arrière au scroll et le retour identique au carrefour.
7. Pousser les corrections sur une branche dédiée, vérifier les logs de GitHub Actions et la qualité visuelle réelle. Ne pas modifier les assertions uniquement pour masquer les problèmes.
8. **Uniquement après validations** : fusionner/publier via le pipeline déjà en place, vérifier l'URL publique et le JavaScript compilé chargé. Remettre un compte rendu précis avec SHA, URL, tests réellement réussis et limites restantes.

## 7. Mode de collaboration voulu par l'utilisateur

- Agir de façon **autonome, concrète, directement sur le dépôt**, sans rester au stade des conseils, ni demander plusieurs fois les mêmes renseignements.
- Produire des modifications testées et contrôlées; **ne jamais annoncer que le site est en ligne sans vérification**. Un lien brisé ou une régression est inacceptable.
- Conserver les fonctionnalités et la fidélité au design demandé. Éviter les raccourcis visuels (fondu, écran blanc, téléportation masquée) qui ne remplacent pas un vrai trajet continu.
- Répondre en français direct, naturel, sans longs comptes rendus de statut. Indiquer honnêtement les blocages.
- Ne pas introduire d'autres projets et ne pas évoquer DevMate sauf demande explicite.
- Aucune modification destructive, ni réécriture forcée de l'historique Git. Préserver `main` jusqu'à validation.

**Résultat final recherché :** 8 projets, 8 chemins, 8 boucles physiques fluides, caméra toujours en avant, retour au même carrefour, aucun demi-tour, aucune téléportation, aucune traversée de paroi, version publiée, testée et accessible.
