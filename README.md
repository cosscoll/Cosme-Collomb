# Portfolio 3D — Cosme Collomb

Portfolio React / Vite, avec parcours immersif WebGL et carrefour 3D à huit projets.

**Site :** https://cosscoll.github.io/Cosme-Collomb/

## Les huit chemins

1. Ouvertures d'échecs en 3D — `Chess-Openings`
2. Probabilités Hold'em — `PokerStats`
3. Brasserie virtuelle — `MyBeer`
4. EuroRare — `Is-my-coin-rare-`
5. Plateforme IFSI — `Berenice.ifsy`
6. IAgile — Formations à l'IA — `IAgile` (vitrine en pré-lancement)
7. Budget Illimité — TCG Thomas Deseur — `TCG-Thomas-Deseur` (collection locale en démonstration)
8. UnCoupDePouce — plateforme de mise en relation BTP (en développement, sans URL publique confirmée)

Les projets sont définis dans `src/data/projects.js` et `src/data/projectStories.js`. La géométrie 3D se construit en fonction de leur nombre. Le carrefour conserve des ouvertures entre les branches et les segments physiques communs des tunnels sont partagés pour éviter les traversées de paroi.

## Développer et valider

```bash
npm install
npm run dev
npm run test:geometry
npm run build
npm run test:browser
```

Le workflow GitHub Actions compile, lance les vérifications et synchronise les actifs publiés sur GitHub Pages.
