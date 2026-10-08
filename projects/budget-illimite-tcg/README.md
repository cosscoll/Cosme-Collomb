# Budget Illimité — TCG Thomas Deseur

> **Chantier isolé**. Prototype de développement, non officiel, sans affiliation à Thomas Deseur ou à ses collaborateurs. Ce dossier est provisoirement hébergé sur une branche dédiée d'un dépôt existant : il devra être transféré vers son propre dépôt.

## État constaté le 8 octobre 2026

L'archive initiale remise contient quatre fichiers : `README.md`, `supabase_schema_concurrency_fixes.sql`, `submit-action-edge-function.ts`, `open-booster-edge-function.ts`. Elle **ne contient pas** le site, le moteur `engine.js`, les fichiers SQL antérieurs ni les images. **Ne pas déployer** le backend partiel tel quel.

Les 49 identifiants/raretés ont été retranscrits du code de booster transmis. Les noms affichés dans cette interface sont des libellés de travail générés depuis les IDs, **pas une validation d'apparitions réelles**.

## Ce qui est utilisable

- `index.html`, `styles.css`, `app.js`, `data/cards.js` : prototype statique de l'inventaire des 49 cartes.
- Recherche textuelle, filtre par rareté, fenêtre de détails, suivi local des cartes repérées, affichage adapté au mobile.
- Aucune carte réelle, photo, source vidéo ou donnée de combat n'a été inventée.
- Les marqueurs « repérées » servent uniquement à organiser la documentation en local : **ce n'est pas une vraie collection possédée ni une monnaie virtuelle**.

Pour prévisualiser : ouvrir `index.html` depuis un serveur HTTP local (ex. `python -m http.server 8000` depuis ce dossier). Le navigateur doit permettre le chargement des modules ES.

## Bloquants pour le vrai jeu

1. Récupérer `engine.js` et le site initial.
2. Récupérer les migrations SQL initiales et rattacher un environnement Supabase de développement.
3. Vérifier les 49 apparitions, sources vidéos, droits sur les médias et capacités des cartes.
4. Corriger les vulnérabilités identifiées avant l'exposition publique : RPC privileged, changements d'état PvP non atomiques, état secret des pioches, CORS, minuterie, contrôle des erreurs.
5. Écrire les tests de combat, d'économie et d'équilibrage; seulement ensuite activer les comptes et le PvP.

Consulter `docs/AUDIT_ET_FEUILLE_DE_ROUTE.md`. Aucune modification n'a été appliquée en production Supabase. Aucun déploiement GitHub Pages n'a été activé.

## Sécurité et contributions

Jamais de clé `service_role`, de mot de passe ou de fichier `.env` dans le dépôt. Les futures fonctions Edge doivent valider le JWT, l'autorisation joueur, les données entrantes et gérer des écritures atomiques. Le serveur, jamais le navigateur, attribue cartes, budget et victoire.
