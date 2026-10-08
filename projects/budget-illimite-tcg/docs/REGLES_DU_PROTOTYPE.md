# Règles de Budget Illimité — prototype solo 0.1

> Ces règles sont **expérimentales**, et NON une restitution du moteur d'origine. Celui-ci était absent du ZIP fourni. Elles sont destinées à valider une expérience jouable.

## Préparation

Chaque participant dispose de 8 cartes distinctes sélectionnées dans les 49 IDs du prototype.
Le joueur personnalise librement son deck ; Billy utilise actuellement une liste fixe.
Chaque camp mélange son deck avec une graine pseudo-aléatoire de la partie. Une carte est active, deux sont en réserve et cinq restent dans la pioche.

Toutes les cartes sont disponibles en mode de démonstration. Les raretés n'augmentent **pas** artificiellement la puissance des cartes. Il n'existe pas encore de propriété ou d'achat de cartes.

## Objectif

Être le premier à infliger **3 KO** aux cartes adverses. Un KO survient quand les PV de la carte active adverse atteignent zéro. La carte est alors défaussée ; une carte de réserve devient automatiquement active et la réserve est remplie depuis la pioche, si possible.

## Déroulement

Le joueur commence avec **1 point d'énergie** ; Billy aussi. Lorsque son tour commence, chaque camp reçoit +1 énergie, dans la limite de 5 (ce bonus s'applique au passage de tour ; il n'est pas donné une seconde fois à l'initialisation).

À chaque tour, effectuer **une seule action** :

1. **Frappe rapide** : dégâts immédiats correspondant aux statistiques du personnage, sans coût.
2. **Capacité spéciale** : dégâts supérieurs, consomme 2 énergies. Inaccessible si l'énergie est insuffisante.
3. **Concentration** : +2 énergie (plafond 5) et +14 points de protection (ou +22 en rôle Rempart), protection cumulée au maximum à 35.
4. **Échange de carte active** : échange avec une carte de réserve ; les PV respectifs sont conservés, +6 protection (plafond 35).

La protection absorbe les dégâts entrants avant les PV. Une protection restante peut perdurer après l'attaque. Elle disparaît lorsqu'une carte active tombe KO. Chaque action termine le tour et rend la main à l'adversaire.

## Rôles

Les rôles sont dérivés des IDs par une fonction stable afin d'éviter de présenter des statistiques inventées comme des faits sur des vidéos. Les quatre rôles ont des profils similaires en puissance globale :

- **Assaut** : frappe rapide supérieure.
- **Rempart** : PV élevés et concentration qui donne plus de protection.
- **Tacticien** : récupère 1 énergie après sa capacité spéciale.
- **Chaos** : +10 dégâts à sa capacité lorsque ses PV sont au plus à la moitié de son maximum.

Les rares, épiques, légendaires et secrètes ne reçoivent pas de bonus automatique. Cette première version doit être équilibrée avec des simulations et des retours de joueurs.

## Sauvegarde et sécurité

Le deck et les marqueurs de documentation sont conservés **uniquement dans le navigateur**. Ils ne constituent ni un compte, ni une collection de cartes possédées, ni un droit à des récompenses. Les matches solo ne sont pas des rencontres classées.

Le prototype de booster est indépendant de l'économie : aucune monnaie n'est débitée et les cartes affichées ne sont pas ajoutées au compte. Le futur multijoueur devra être arbitré côté serveur avec données cachées et transactions garanties.

## Niveaux de Billy

Le niveau est choisi **avant** le début de la partie et ne peut pas être modifié pendant le duel.

- **Découverte** : privilégie les frappes simples, utilise occasionnellement une capacité ou une concentration.
- **Normal** : utilise son énergie et peut changer de combattant pour préserver un personnage affaibli.
- **Expert** : évalue les conséquences immédiates de toutes les actions autorisées, notamment les KO, la protection, les changements et la gestion de l'énergie. Il ne reçoit **aucune information sur l'ordre caché des cartes de l'adversaire**.

Ce sont des comportements de prototype, susceptibles d'évoluer après de vrais tests utilisateurs. Les taux issus des scripts d'équilibrage ne sont pas des estimations du comportement de joueurs humains.

## Recommandation de deck

Un bouton propose automatiquement **8 cartes distinctes** avec exactement 2 Assaut, 2 Rempart, 2 Tacticien et 2 Chaos. Ce choix est disponible librement pour essayer les mécaniques ; il ne signifie pas que les cartes sont possédées dans une collection en ligne.

## Palmarès et défis locaux

Chaque duel **terminé** enregistre une seule fois son résultat dans le navigateur : parties, victoires, défaites, série actuelle, record de victoires, KO et actions. Les matchs interrompus ou recommencés ne sont pas comptabilisés. Six défis symboliques sont proposés : premier duel, première victoire, 10 KO, 10 duels, 3 victoires consécutives et 20 victoires. Ils ne débloquent ni cartes, ni Budget. Effacer les données du navigateur peut remettre ce suivi à zéro.

## Accessibilité du prototype

Les commandes sont de vrais boutons, les dialogues utilisent `<dialog>`, les jauges de vie possèdent des valeurs accessibles et les animations des boosters respectent `prefers-reduced-motion`. L'utilisation complète au clavier et avec un lecteur d'écran **reste à tester dans de vrais navigateurs**, au même titre que le rendu mobile.
