# Portfolio 3D — Guide de mise en ligne (étape par étape)

Ce projet est prêt à l'emploi. Voici comment le faire fonctionner et le mettre en ligne, même si tu n'as jamais fait ça.

## 1. Installer Node.js (une seule fois)

Télécharge et installe la version "LTS" sur https://nodejs.org (clique, suis l'installeur, next-next-next).

## 2. Tester le site sur ton ordinateur

Ouvre un terminal dans le dossier du projet (sur Mac : clic droit sur le dossier → "Nouveau terminal au dossier" ; sur Windows : dans l'explorateur, tape `cmd` dans la barre d'adresse), puis tape :

```
npm install
npm run dev
```

Un lien va s'afficher (genre `http://localhost:5173`) — ouvre-le dans ton navigateur, c'est ton site en local.

## 3. Personnaliser le contenu

Ouvre `src/App.jsx` avec un éditeur de texte (VS Code recommandé, gratuit : https://code.visualstudio.com). Tout en haut du fichier tu trouveras :

```js
const NAME = 'Ton Nom'
const TAGLINE = "..."
const PROJECTS = [ ... ]
```

Remplace ces valeurs par les tiennes. Change aussi l'email dans `Contact()` un peu plus bas.

## 4. Créer le repo GitHub

1. Va sur https://github.com/new
2. Donne un nom à ton repo (ex : `mon-portfolio`)
3. Laisse-le public, ne coche rien d'autre, clique "Create repository"

## 5. Adapter le chemin de base

Ouvre `vite.config.js` et remplace `/mon-portfolio/` par `/nom-exact-de-ton-repo/` (avec les slashs).
Exception : si ton repo s'appelle exactement `ton-pseudo-github.github.io`, mets `base: '/'`.

## 6. Envoyer le code sur GitHub

Dans le terminal, toujours dans le dossier du projet :

```
git init
git add .
git commit -m "premier envoi du portfolio"
git branch -M main
git remote add origin https://github.com/TON-PSEUDO/NOM-DU-REPO.git
git push -u origin main
```

(remplace `TON-PSEUDO` et `NOM-DU-REPO` par les tiens — GitHub te montre cette commande exacte sur la page de ton repo vide)

## 7. Activer GitHub Pages

Sur GitHub, va dans ton repo → **Settings** → **Pages** (menu de gauche) → sous "Build and deployment", choisis **Source : GitHub Actions**.

C'est tout. À chaque fois que tu fais `git push`, le site se reconstruit et se met à jour automatiquement (regarde l'onglet **Actions** de ton repo pour voir la progression). Ton site sera visible à l'adresse `https://TON-PSEUDO.github.io/NOM-DU-REPO/`.

## Structure du projet

- `src/components/HeroScene.jsx` — la scène 3D (sphère distordue + particules)
- `src/components/Reveal.jsx` — animation de révélation au scroll
- `src/components/CursorGlow.jsx` — halo lumineux qui suit la souris
- `src/App.jsx` — toutes les sections du site (héro, à propos, projets, contact)
- `src/styles/global.css` — couleurs et typographie

## Pour aller plus loin

Reviens me voir si tu veux : ajouter des vraies images/screenshots de projets, une page individuelle par projet, changer les couleurs, ajouter d'autres formes 3D, ou améliorer les performances mobile.
