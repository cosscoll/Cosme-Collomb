## Transmission à ChatGPT Work

Le dossier complet de reprise du chantier 3D se trouve dans **[docs/CHATGPT_WORK_TRANSMISSION.md](docs/CHATGPT_WORK_TRANSMISSION.md)**. Le code expérimental des boucles sans demi-tour reste sur la branche `dev/forward-only-loops` et ne doit pas être publié avant que le test navigateur de retour au carrefour soit validé.

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

<!-- Release: three new projects, eight distinct routes. -->

## Fluidité et performance 3D — octobre 2026

Le rendu des huit tunnels réutilise des géométries GPU mises en cache, un maillage allégé et des matériaux moins coûteux. La caméra suit les défilements avec une limite de déplacement physique par image ; les changements de page conservent leur trajectoire sur les segments partagés, et la construction des ponts n'interrompt plus l'approche du carrefour. Les positions des sections sont recalculées lors des changements de mise en page et non à chaque rendu WebGL. La grille des huit projets évite de multiplier les flous d'arrière-plan sur le canvas.

Exécuter `npm run test:geometry` et `npm run test:browser` avant publication. Les tests vérifient aussi les transitions, la continuité des ponts et le retour au carrefour.
