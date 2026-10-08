# Audit technique et feuille de route — 2026-10-08

## Sources examinées
L'archive `files (9).zip` transmise dans la conversation contient :
- `README.md` (description historique du jeu, et déploiement GitHub Pages / Supabase)
- `supabase_schema_concurrency_fixes.sql` (transactions booster, matchmaking, rate limit et reaper)
- `submit-action-edge-function.ts` (actions et persistance PvP)
- `open-booster-edge-function.ts` (tirages et débits)

**Absents** : `engine.js`, `index.html` original, médias, `supabase_schema.sql`, `supabase_schema_trading.sql`, `supabase_schema_ranked.sql`, `supabase_schema_hidden_info.sql`, `card_catalog_seed.sql`, `supabase_schema_rng.sql`. On ne peut pas reconstituer fidèlement les règles, les cartes ou l'interface actuelle sans ces sources.

## Avancement réalisé dans ce dossier
- Branche GitHub de travail isolée pour ne pas modifier le site du dépôt existant.
- Inventaire reproductible des **49 IDs existants** : 17 communes, 15 rares, 10 épiques, 4 légendaires, 3 secrètes.
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
