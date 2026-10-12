# Réseau continu du portfolio

La scène de production utilise `src/scene/spatialNetwork.js`,
`src/scene/networkMotion.js`, `src/scene/networkMesh.js` et
`src/components/World.jsx`. Les anciens modules `geometry.js` et `transit.js`
restent des références historiques ; ils ne pilotent plus cette scène.

## Source spatiale unique

Les huit projets disposent de huit boucles orientées. Une galerie latérale
relie les pages accueil, parcours et contact. Chaque connexion commence et
se termine au même nœud, à `[0, 0, 6]`, avec la tangente `[0, 0, -1]`.
Les courbes de Bézier adjacentes partagent leur position et leur direction.
La voie de retour se trouve à l'extérieur de la voie d'aller.

`planJourney` termine la connexion courante, traverse le nœud puis rejoint
la destination par des connexions orientées. Il ne réduit jamais la distance
parcourue à l'intérieur d'une connexion. Un tour supplémentaire de galerie
permet d'atteindre un arrêt déjà dépassé. Les visites précédentes ne changent
ni les huit accès, ni les parois, ni la position du carrefour.

Le scroll contrôle un maximum de progression conservé pour la visite.
Remonter le texte ne fait pas reculer l'œil. Un clic pendant une transition
est conservé puis exécuté après l'arrivée physique. Le changement de page
attend ce jalon ; aucun délai arbitraire ne replace la caméra.

## Surface fermée

`scripts/build-network.mjs` calcule l'union des volumes intérieurs du
carrefour et des galeries. Marching Cubes produit une surface unique ; les
sommets communs sont soudés et les faces dégénérées sont supprimées.
Les embouchures et les virages appartiennent à ce même maillage, sans
coques superposées ou ouvertures découpées à partir de pourcentages estimés.

Le maillage compilé est généré avant les tests géométriques et avant Vite.
Il n'est pas calculé pendant une visite. Les partitions de rendu utilisent
les mêmes sommets et normales ; elles permettent le rejet des volumes hors
champ. Les éléments lumineux et les plaques de sol sont décoratifs, montés
à l'intérieur de cette surface permanente. La construction du sol ne retire
aucune paroi.

## Caméra

La pose est obtenue directement sur la connexion parcourue, en mètres.
La rotation suit sa tangente avant. La vitesse diminue avant une courbe et
chaque déplacement est plafonné à 0,42 m par image rendue. Il n'y a ni
filtre de position indépendant, ni correction de raccord par translation.
Le champ de vision reste constant pendant une visite pour un même format
d'écran. La densité de pixels s'adapte au temps de rendu.

## Vérifications

`npm run test:geometry` contient les tests historiques et les vérifications
du réseau de production : signature du graphe, deux triangles par arête,
continuité des courbes, transferts orientés, scroll inversé, vitesse et
rayons contre le maillage réellement rendu.

`npm run test:browser` visite les huit projets successivement dans un seul
Canvas. Il vérifie les positions et quaternions rendus, le retour identique,
la conservation du maillage et des huit liens, la construction du sol, les
clics en transition, les pages secondaires, l'accès direct, le rechargement,
l'historique, trois formats d'écran et une boucle complète sur mobile.
Les positions enregistrées sont rejouées contre les véritables triangles
des parois. Les captures et le rapport JSON se trouvent dans `test-output/`.

Les commandes historiques `tests/browser-smoke.mjs` et
`tests/prototype-v2-browser.mjs` lancent désormais ce contrôle de production.
Les démos isolées dans `prototype-3d/` sont des archives expérimentales.

## Publication

`deploy.yml` est le seul workflow qui synchronise les fichiers publics.
Il attend les contrôles géométriques et les huit boucles en navigateur,
puis vérifie le bundle effectivement servi et une visite WebGL publique.
Le contrôle responsive public complet suit la réussite de ce workflow.
Une validation du formulaire de contact ne peut plus publier une version
avant les contrôles de navigation.

Installation et développement : `npm ci`, puis `npm run build` et
`npm run preview`. Une nouvelle définition du graphe exige de régénérer
le maillage ; les scripts npm le font automatiquement.
