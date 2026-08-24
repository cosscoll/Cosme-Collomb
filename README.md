# Site — Cosme Collomb

Site personnel (portfolio + vitrine) en HTML/CSS/JS pur, aucune dépendance
de build, structuré en 4 pages :

- `index.html` — accueil, hero 3D uniquement
- `about.html` — À propos
- `projects.html` — Projets (Les Abattoirs, Un Coup de Pouce, DevMate)
- `contact.html` — Contact

`style.css`, `script.js` et `hero3d.js` sont partagés par toutes les pages.

## Le hero 3D

Jeu d'échecs complet et procédural (aucun fichier 3D externe) : 8 pions +
tour, cavalier, fou, dame, roi — dame et roi en matériau clair pour
ressortir. Plateau en damier avec reflet au sol (duplicata miroir
semi-transparent). Effet bloom + grain filmique + vignette faits à la
main (shader personnalisé), sans aucune dépendance externe autre que le
cœur de Three.js.

**Important : plus de dépendance à OrbitControls ni aux modules de
post-processing officiels de Three.js.** Ces modules chargés depuis un
CDN provoquaient une erreur de résolution de module ("three" introuvable)
sur GitHub Pages. La caméra orbitale et les effets visuels sont
maintenant codés à la main avec uniquement `three.module.js` — un seul
import, donc plus aucun risque de ce type d'erreur.

**Interactions :**
- Glisser (clic maintenu) sur une zone vide pour faire pivoter la scène,
  molette pour zoomer
- Glisser directement une pièce pour la déplacer — elle s'accroche à la
  case la plus proche en relâchant
- Clic simple sur une pièce (sans glisser) : elle fait un petit saut
- Rotation lente automatique quand on n'interagit pas

## ⚠️ Points d'attention

- **Molette captée par la scène** : tant que le curseur est sur le hero
  (plein écran), la molette zoome au lieu de faire défiler la page —
  choix assumé pour l'immersion. Les liens de nav et les boutons
  "Voir mes projets" / "À propos" contournent ça.
- **Desktop uniquement** : sur mobile/tactile ou avec "réduire les
  animations" activé, le hero 3D ne se charge pas du tout.
- **Test en local** : `hero3d.js` est un module — `file://` ne fonctionne
  pas. Utilise `python3 -m http.server` puis `http://localhost:8000`,
  ou teste directement sur GitHub Pages (`https://` fonctionne sans
  rien faire de plus).

## Mettre à jour sur GitHub Pages

Réuploade les fichiers modifiés avec le même nom (GitHub propose de les
écraser). Chaque commit redéploie automatiquement, compte 1-2 minutes —
le CDN de GitHub Pages peut mettre jusqu'à 10 minutes à se rafraîchir
partout, même en navigation privée.
