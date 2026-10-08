// ============================================================================
// TES PROJETS — remplace ces entrées par les tiens, ou ajoutes-en autant que tu veux.
// Chaque projet a sa propre page (/projets/<slug>) avec une scène 3D interactive
// dédiée, différente pour chaque projet.
//
// Champs obligatoires :
//   title       — nom du projet (obligatoire)
//   description — 1 à 3 phrases, résumé pour les listes (accueil, grille projets)
//
// Champs optionnels — la page s'adapte à ce que tu remplis, rien n'est obligatoire :
//   slug        — identifiant dans l'URL, ex. 'mon-projet' → /projets/mon-projet
//                 (généré automatiquement à partir du titre si absent)
//   role        — ton rôle sur ce projet, ex. "Développeur full-stack solo"
//   duration    — durée ou période, ex. "3 mois" ou "2024 — 2025"
//   year        — année affichée dans les listes (ex. "2025")
//   tags        — technos ou mots-clés (tableau de chaînes)
//   challenge   — le problème ou l'objectif de départ (1 paragraphe)
//   approach    — comment tu t'y es pris, les choix techniques (1 paragraphe)
//   outcome     — le résultat, l'impact, ce que ça a changé (1 paragraphe)
//   link        — URL de démo / site en ligne (optionnel)
//   repoLink    — URL du dépôt de code, ex. GitHub (optionnel)
//   image       — image de couverture pour les listes, ex. '/projects/mon-projet.jpg'
//   gallery     — tableau d'images supplémentaires pour la page projet, ex.
//                 ['/projects/mon-projet-1.jpg', '/projects/mon-projet-2.jpg']
//                 (laisse vide tant que tu n'as pas d'images — des blocs "Image à
//                 venir" s'affichent à la place)
//   featured    — true pour apparaître dans la sélection mise en avant sur l'accueil
//                 (limite-toi à 2 ou 3 projets "featured")
//   visual      — visuel 3D de la page projet : 'rings' (tunnel d'anneaux à traverser),
//                 'liquid' (métal liquide organique), 'constellation' (réseau de
//                 nœuds lumineux), 'planets' (champ de planètes façon voyage spatial)
//                 — optionnel, si absent un visuel différent est assigné automatiquement
//
// NOTE — projets ajoutés le 02/10 à partir de tes liens GitHub Pages :
// - year, role, duration, challenge/approach/outcome sont laissés vides : je n'ai
//   que ce que montrent les pages elles-mêmes, pas le contexte de leur création.
//   Remplis-les quand tu veux, ou dis-moi et je rédige un brouillon à partir de ce
//   que tu me racontes.
// - repoLink est déduit du nom du dépôt GitHub Pages (cosscoll/<nom>) — à vérifier,
//   corrige si le vrai dépôt a un nom différent ou est privé (auquel cas retire le lien).
// ============================================================================

export const PROJECTS = [
  {
    title: "Ouvertures d'échecs en 3D",
    description:
      "Un échiquier en 3D où l'on choisit une ouverture puis on scrolle pour voir la ligne théorique se jouer, coup après coup, sous ses yeux.",
    tags: ['3D', 'Échecs', 'Scroll interactif'],
    year: '',
    role: '',
    duration: '',
    challenge: '',
    approach: '',
    outcome: '',
    link: 'https://cosscoll.github.io/Chess-Openings/',
    repoLink: 'https://github.com/cosscoll/Chess-Openings',
    image: '',
    gallery: [],
    featured: false,
    visual: 'constellation',
  },
  {
    title: "Probabilités Hold'em",
    description:
      "Un outil d'entraînement au Texas Hold'em : on compose sa main et le tableau commun, et l'équité, les outs et le classement de la main se calculent en direct, par simulation Monte-Carlo exécutée entièrement dans le navigateur.",
    tags: ['Probabilités', 'Simulation Monte-Carlo', 'Poker'],
    year: '',
    role: '',
    duration: '',
    challenge: '',
    approach: '',
    outcome: '',
    link: 'https://cosscoll.github.io/PokerStats/',
    repoLink: 'https://github.com/cosscoll/PokerStats',
    image: '',
    gallery: [],
    featured: false,
    visual: 'rings',
  },
  {
    title: 'Brasserie virtuelle',
    description:
      "Un configurateur de recette de bière en 9 étapes (fermentation, malts, houblon, arômes, sucrosité, carbonatation, degré d'alcool...) : la bière prend forme en 3D en temps réel derrière le questionnaire, jusqu'à révéler le style obtenu.",
    tags: ['3D temps réel', 'Configurateur'],
    year: '',
    role: '',
    duration: '',
    challenge: '',
    approach: '',
    outcome: '',
    link: 'https://cosscoll.github.io/MyBeer/',
    repoLink: 'https://github.com/cosscoll/MyBeer',
    image: '',
    gallery: [],
    featured: true,
    visual: 'liquid',
  },
  {
    title: 'EuroRare',
    description:
      "Un guide visuel pour identifier l'origine, l'année et les particularités de pièces et billets en euro, et comprendre pourquoi certains exemplaires sont recherchés — pièces, billets, pays émetteurs et erreurs de frappe.",
    tags: ['Numismatique', 'Guide interactif'],
    year: '',
    role: '',
    duration: '',
    challenge: '',
    approach: '',
    outcome: '',
    link: 'https://cosscoll.github.io/Is-my-coin-rare-/',
    repoLink: 'https://github.com/cosscoll/Is-my-coin-rare-',
    image: '',
    gallery: [],
    featured: false,
    visual: 'planets',
  },
  {
    title: 'Plateforme IFSI — Bérénice',
    description:
      "Un tableau de bord d'étude complet pour une formation en soins infirmiers : catalogue des 59 unités d'enseignement, fiches de révision en répétition espacée, cartes mentales, planches d'anatomie, simulations de cas cliniques ECOS et suivi de tâches — avec une petite assistante intégrée.",
    tags: ['Plateforme éducative', 'Révision espacée', 'Simulation clinique'],
    year: '',
    role: '',
    duration: '',
    challenge: '',
    approach: '',
    outcome: '',
    link: 'https://cosscoll.github.io/Berenice.ifsy/',
    repoLink: 'https://github.com/cosscoll/Berenice.ifsy',
    image: '',
    gallery: [],
    featured: true,
  },
]

// Transforme un titre en identifiant d'URL propre : "Mon Super Projet !" → "mon-super-projet"
export function slugify(title) {
  return title
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // retire les accents
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

// Liste enrichie : chaque projet a toujours un slug, même si tu n'en as pas précisé.
export const PROJECTS_WITH_SLUGS = PROJECTS.map((p) => ({
  ...p,
  slug: p.slug || slugify(p.title),
}))
