# Audit technique et feuille de route — 2026-10-08

## Sources examinées
L'archive `files (9).zip` transmise dans la conversation contient :
- `README.md` (description historique du jeu, et déploiement GitHub Pages / Supabase)
- `supabase_schema_concurrency_fixes.sql` (transactions booster, matchmaking, rate limit et reaper)
- `submit-action-edge-function.ts` (actions et persistance PvP)
- `open-booster-edge-function.ts` (tirages et débits)

**Absents** : `engine.js`, `index.html` original, médias, `supabase_schema.sql`, `supabase_schema_trading.sql`, `supabase_schema_ranked.sql`, `supabase_schema_hidden_info.sql`, `card_catalog_seed.sql`, `supabase_schema_rng.sql`. On ne peut pas reconstituer fidèlement les règles, les cartes ou l'interface actuelle sans ces sources.

## État du premier cycle — 8 octobre 2026

**Phase 1 (fondations du prototype) : effectuée.** Le projet est isolé sur la branche de travail, les 49 identifiants sont testés, les sources manquantes sont consignées. Le nouvel éditeur de decks, le moteur solo et les interfaces sont ajoutés.

**Phase 2 (moteur solo expérimental) : première version implémentée.** Un match se joue jusqu'à 3 KO avec huit cartes par camp, quatre profils de combattants, actions validées, IA Billy et historique des événements. Cette implémentation est **indépendante** du moteur PvP d'origine introuvable et ne représente pas les règles historiques.

**Tests effectués :** 14 scénarios de catalogue, booster et moteur réussis via un interpréteur JavaScript lors du travail ; 50 puis 200 simulations de parties utilisées pour inspecter le déroulement et le rapport de victoire ; un parcours d'interface simulé couvre sélection de carte, édition de deck, duel complet, revanche et booster. Les tests Node (`npm test`) et un workflow CI GitHub Actions sont également enregistrés dans le dépôt. Les tests en vrai navigateur restent à réaliser.

**Déséquilibre observé :** un joueur qui ne fait que frapper dès qu'il dispose d'énergie suffisante gagne moins souvent qu'une IA qui gère davantage sa stratégie ; ce résultat ne constitue pas encore une mesure d'équilibrage par population de joueurs.

**Restant immédiat :** tests manuels sur Chrome/Firefox/Safari/mobile, vérification clavier et lecteur d'écran, UX du deck, simulation sur plusieurs stratégies, tutoriel in-app, identification de vraies images et médias.

## Deuxième cycle — IA, progression et lisibilité (8 octobre 2026)

- Ajout de trois difficultés pour Billy : Découverte, Normal, Expert. Mode Expert évalue chaque action légale sur un tour, sans voir de cartes cachées ni utiliser de droits serveur.
- Ajout d'un palmarès **local et symbolique** : duels, résultats, séries, KO, défis. Aucun compte ni carte virtuelle attribuée.
- Atelier de deck : recommandation automatique de **2 cartes par rôle**, affichage de la composition.
- Animations séquencées de la simulation de booster, désactivées en cas de préférence de mouvement réduit.
- Jauges de vie accessibles et annonce de résultat, réduction des annonces inutiles dans le catalogue.
- Tests de logique : **20 scénarios réussis** exécutés via un interpréteur JavaScript pendant la session, couvrant les quatre modules catalogue / moteur / boosters / progression.
- **900 matchs simulés avec des compositions de decks variées**, 300 par difficulté, tous terminés sans erreur. Comparaison contre une stratégie purement offensive : 300/300 victoires du joueur en Découverte, 101/300 en Normal et 9/300 en Expert. **Ces chiffres ne sont pas des statistiques humaines** ; la difficulté Expert reste très exigeante face à un joueur qui ne sait pas protéger ses cartes.
- Parcours d'interface simulé : catalogue, détails, rôle, deck suggéré, difficulté, duel terminé, palmarès persisté, annulation des anciens callbacks IA lors d'une revanche, booster. Contrôles réussis dans un DOM factice ; pas de test graphique sur navigateur physique.
- Création d'un outil reproductible `npm run balance` (9 confrontations par nombre de graines, trois difficultés × trois stratégies) et d'une version étendue `npm run balance:extended`.
- GitHub Actions CI prévu dans la branche. **L'exécution distante du workflow et l'affichage dans Chrome, Firefox et Safari n'ont pas pu être certifiés pendant cette session.**

**Prochaines priorités** : prévisualisation web sur un environnement dédié sans modifier `main`, tests manuels mobile et clavier, retours de vrais joueurs pour l'équilibrage, récupération du frontend et moteur d'origine, vidéos et droits, puis raccordement Supabase sécurisé.

## Avancement réalisé dans ce dossier
- Branche GitHub de travail isolée pour ne pas modifier le site du dépôt existant.
- Inventaire reproductible des **49 IDs existants** : 17 communes, 15 rares, 10 épiques, 4 légendaires, 3 secrètes.
- **Prototype solo jouable** : deck de huit cartes, joueur/Billy, protection, énergie, réserves, KO, victoire.
- Interface de combat et atelier du deck ajoutés, tests et règles documentées.
- Prototype interactif responsive : liste, recherche, filtre, détail, suivi local de documentation.
- Identification explicite des sources, médias et statistiques non vérifiés.
- Tests unitaires des invariants du catalogue, disponibles par `npm test`.
- Aucune donnée privée ni secret, aucun déploiement Supabase ou production.

## Défauts identifiés dans les sources reçues (non corrigés en production)

**P0 — Appels SQL privilégiés** : `public.claim_booster(p_user, p_cost, p_card_ids)` est `SECURITY DEFINER` et utilise des paramètres fournis par l'appelant. Le fichier ne fait aucun `REVOKE EXECUTE` explicite sur cette fonction. Vérifier les droits existants puis verrouiller son exécution aux rôles de service; vérifier aussi `check_rate_limit`, `try_match_players`, `apply_match_result` et toutes les fonctions privilégiées.

**P0 — Cohérence des parties** : `submit-action` met à jour `matches` puis écrit séparément `match_private`, `match_rng` et `match_actions`. Si une écriture échoue, l'état devient incohérent. Remplacer par une validation + écriture atomique sur le serveur, avec verrou/version et gestion explicite des erreurs.

**P0 — Informations cachées** : `buildViewFor` renvoie au client son paquet (`deck`) sans preuve que ce dernier est masqué/mélangé. Le contenu et l'ordre de la pioche doivent rester côté serveur.

**P1 — Limite de tour** : la date de fin est recalculée à chaque action, et le reaper choisit le joueur 1 comme gagnant quand `state` n'est pas initialisé. Corriger le démarrage du chrono, le passage de tour et les cas de matches non initialisés.

**P1 — CORS / traitement HTTP** : aucun préflight `OPTIONS` ni en-tête CORS sur les Edge Functions fournies. Ajouter une allowlist des origines, une gestion explicite des méthodes et des réponses cohérentes.

**P1 — Tirage des boosters** : la boucle de 20 essais peut en théorie terminer sur une commune pour la cinquième carte. Utiliser une sélection directe dans un pool non-commun. Éliminer aussi les duplications de tables de raretés entre frontend/backend.

**P1 — Gestion des erreurs** : vérifier la réussite des appels rate limit et des sauvegardes privées, renvoyer des erreurs contrôlées, pas les messages bruts de la base.

**P2 — Documentation obsolète** : le README initial décrit simultanément une application purement locale sans serveur et un backend PvP Supabase. Unifier l'architecture.

## Itérations proposées

**Phase 1 — Fondation** : récupérer les fichiers manquants, figer les règles, intégrer les vraies données des cartes, valider le fonctionnement local, documenter les cas limites.

**Phase 2 — Jouabilité solo** : construire et tester l'interface de combat, tutoriel, decks, tour par tour, sauvegarde locale pour prototype (distincte du compte serveur).

**Phase 3 — Backend sécurisé** : créer un environnement Supabase de développement, migrations contrôlées, RLS, opérations transactionnelles, prévalidation, tests d'abus et de concurrence.

**Phase 4 — PvP et économie** : comptes, synchronisation, boosters, matchmaking, parties classées, échanges. Tester avant publication.

**Phase 5 — Qualité** : responsive et accessibilité, performance des médias, métadonnées SEO, suivi de bugs, gestion des droits à l'image / vidéogrammes, déploiement et contrôle post-publication.

## Définition de « prêt à lancer »
Toutes les opérations économiques sont autoritatives; les règles fonctionnent sur des parties complètes; les secrets et les mains cachées ne fuitent pas; les workflows de comptes et PvP sont testés avec deux joueurs et sous concurrence; le catalogue est documenté; les visuels ont une base légale de réutilisation; aucune erreur JS ou problème mobile majeur n'est connu.
