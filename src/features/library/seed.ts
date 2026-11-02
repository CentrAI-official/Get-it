import {
  tagOf,
  type ALLERGENS,
  type DIETS,
  type EQUIPMENT,
  type LEVELS,
  type LibraryItemInput,
  type MEALS,
  type MENTAL_THEMES,
  type MUSCLES,
  type NUTRITION_GOALS,
  type PLACES,
  type SOCIAL_THEMES,
} from "./rules";

// Contenu de départ du catalogue (rédigé avec Get iT AI, 2026-11-01). Importé
// en brouillons par l'équipe (Réglages › Catalogue) : chaque fiche est relue
// (forme des exercices, allergènes des recettes) avant d'être publiée. Les
// vidéos et les photos sont ajoutées ensuite par l'équipe.

type Of<T extends readonly string[]> = T[number];
export type SeedItem = LibraryItemInput & { seedKey: string };

const content = (fields: {
  title: string;
  summary: string;
  description: string;
  steps: string[];
  cues?: string[];
  mistakes?: string[];
  ingredients?: string[];
}) => ({
  fr: {
    cues: [],
    mistakes: [],
    ingredients: [],
    ...fields,
  },
  en: null,
});

function exercise(
  key: string,
  fields: {
    title: string;
    summary: string;
    description: string;
    steps: string[];
    cues: string[];
    mistakes: string[];
    muscles: Of<typeof MUSCLES>[];
    places: Of<typeof PLACES>[];
    equipment: Of<typeof EQUIPMENT>[];
    level: Of<typeof LEVELS>;
  },
): SeedItem {
  const { muscles, places, equipment, level, ...text } = fields;
  return {
    seedKey: `exercise:${key}`,
    kind: "exercise",
    pillar: null,
    minutes: null,
    servings: null,
    tags: [
      ...muscles.map((value) => tagOf("muscle", value)),
      ...places.map((value) => tagOf("place", value)),
      ...equipment.map((value) => tagOf("equipment", value)),
      tagOf("level", level),
    ],
    content: content(text),
  };
}

function recipe(
  key: string,
  fields: {
    title: string;
    summary: string;
    description: string;
    ingredients: string[];
    steps: string[];
    minutes: number;
    servings: number;
    meals: Of<typeof MEALS>[];
    goals: Of<typeof NUTRITION_GOALS>[];
    diets?: Of<typeof DIETS>[];
    /** Allergènes que la recette contient (vérifiés ingrédient par ingrédient). */
    allergens: Of<typeof ALLERGENS>[];
  },
): SeedItem {
  const {
    minutes,
    servings,
    meals,
    goals,
    diets = [],
    allergens,
    ...text
  } = fields;
  return {
    seedKey: `recipe:${key}`,
    kind: "recipe",
    pillar: null,
    minutes,
    servings,
    tags: [
      ...meals.map((value) => tagOf("meal", value)),
      ...goals.map((value) => tagOf("goal", value)),
      ...diets.map((value) => tagOf("diet", value)),
      ...allergens.map((value) => tagOf("allergen", value)),
    ],
    content: content(text),
  };
}

function tool<P extends "mental" | "social">(
  key: string,
  pillar: P,
  fields: {
    title: string;
    summary: string;
    description: string;
    steps: string[];
    minutes: number;
    themes: (P extends "mental"
      ? Of<typeof MENTAL_THEMES>
      : Of<typeof SOCIAL_THEMES>)[];
  },
): SeedItem {
  const { minutes, themes, ...text } = fields;
  return {
    seedKey: `tool:${key}`,
    kind: "tool",
    pillar,
    minutes,
    servings: null,
    tags: themes.map((value) => tagOf("theme", value)),
    content: content(text),
  };
}

// --- Exercices (40) ---------------------------------------------------------

const EXERCISES: SeedItem[] = [
  exercise("push-up", {
    title: "Pompes",
    summary: "Le classique du haut du corps, sans équipement.",
    description:
      "Les pompes travaillent les pectoraux, les triceps et l’avant des épaules, tout en demandant un tronc solide.",
    steps: [
      "Place tes mains au sol un peu plus larges que tes épaules.",
      "Recule les pieds pour que ton corps forme une ligne droite de la tête aux talons.",
      "Descends en pliant les coudes jusqu’à ce que ta poitrine soit à un poing du sol.",
      "Pousse dans le sol pour remonter jusqu’à avoir les bras tendus.",
    ],
    cues: [
      "Garde les coudes à environ 45 degrés du corps.",
      "Serre les fessiers et les abdos tout le long.",
      "Regarde le sol un peu devant tes mains.",
    ],
    mistakes: [
      "Laisser les hanches s’affaisser vers le sol.",
      "Écarter les coudes à 90 degrés, ce qui charge les épaules.",
    ],
    muscles: ["chest", "triceps", "shoulders"],
    places: ["home", "gym"],
    equipment: ["bodyweight"],
    level: "beginner",
  }),
  exercise("knee-push-up", {
    title: "Pompes sur les genoux",
    summary: "La version accessible des pompes, pour bâtir la force.",
    description:
      "En appui sur les genoux, tu soulèves moins de poids tout en gardant le même mouvement que la pompe complète.",
    steps: [
      "Mets-toi à genoux, mains au sol un peu plus larges que les épaules.",
      "Avance tes mains pour que ton corps forme une ligne droite des genoux à la tête.",
      "Descends la poitrine vers le sol en pliant les coudes.",
      "Remonte en poussant jusqu’à avoir les bras tendus.",
    ],
    cues: [
      "Les hanches restent alignées, pas pliées vers l’arrière.",
      "Garde le cou dans le prolongement du dos.",
      "Descends lentement, remonte avec contrôle.",
    ],
    mistakes: [
      "Plier les hanches et pousser les fesses vers le haut.",
      "Ne descendre qu’à moitié.",
    ],
    muscles: ["chest", "triceps", "shoulders"],
    places: ["home", "gym"],
    equipment: ["bodyweight"],
    level: "beginner",
  }),
  exercise("barbell-bench-press", {
    title: "Développé couché à la barre",
    summary: "L’exercice de base pour la force des pectoraux.",
    description:
      "Allongé sur un banc, tu pousses une barre au-dessus de ta poitrine. Fais-le avec un partenaire qui assure, ou avec des appuis de sécurité.",
    steps: [
      "Allonge-toi sur le banc, les yeux sous la barre, les pieds à plat au sol.",
      "Prends la barre un peu plus large que les épaules et décroche-la bras tendus.",
      "Descends la barre lentement jusqu’au bas des pectoraux.",
      "Pousse la barre vers le haut jusqu’à avoir les bras tendus.",
    ],
    cues: [
      "Serre les omoplates ensemble et vers le bas.",
      "Garde les poignets droits, au-dessus des coudes.",
      "Pousse avec les pieds dans le sol.",
    ],
    mistakes: [
      "Faire rebondir la barre sur la poitrine.",
      "Décoller les fesses du banc.",
      "Soulever lourd sans partenaire ni appuis de sécurité.",
    ],
    muscles: ["chest", "triceps", "shoulders"],
    places: ["gym"],
    equipment: ["barbell"],
    level: "intermediate",
  }),
  exercise("dumbbell-bench-press", {
    title: "Développé couché aux haltères",
    summary: "Le développé couché avec plus d’amplitude et d’équilibre.",
    description:
      "Avec deux haltères, chaque bras travaille seul : un bon moyen de corriger un côté plus faible.",
    steps: [
      "Assieds-toi sur le banc, un haltère sur chaque cuisse.",
      "Allonge-toi en ramenant les haltères à hauteur de poitrine.",
      "Pousse les haltères vers le haut jusqu’à avoir les bras tendus.",
      "Redescends lentement jusqu’à sentir un étirement des pectoraux.",
    ],
    cues: [
      "Les haltères descendent à côté de la poitrine, pas au-dessus du visage.",
      "Garde les omoplates serrées.",
      "Contrôle la descente sur deux à trois secondes.",
    ],
    mistakes: [
      "Laisser tomber les haltères en bas du mouvement.",
      "Cambrer fortement le bas du dos.",
    ],
    muscles: ["chest", "triceps", "shoulders"],
    places: ["gym", "home"],
    equipment: ["dumbbells"],
    level: "beginner",
  }),
  exercise("incline-dumbbell-press", {
    title: "Développé incliné aux haltères",
    summary: "Cible le haut des pectoraux.",
    description:
      "Le banc incliné à 30 ou 45 degrés met l’accent sur le haut de la poitrine et l’avant des épaules.",
    steps: [
      "Règle le banc entre 30 et 45 degrés.",
      "Assieds-toi, dos bien appuyé, haltères à hauteur d’épaules.",
      "Pousse les haltères vers le haut et légèrement vers l’intérieur.",
      "Redescends lentement à hauteur de poitrine.",
    ],
    cues: [
      "Garde le dos et la tête appuyés sur le banc.",
      "Les coudes restent sous les poignets.",
      "Expire en poussant.",
    ],
    mistakes: [
      "Incliner le banc trop haut, ce qui transforme l’exercice en développé d’épaules.",
      "Cogner les haltères en haut.",
    ],
    muscles: ["chest", "shoulders", "triceps"],
    places: ["gym"],
    equipment: ["dumbbells"],
    level: "intermediate",
  }),
  exercise("cable-fly", {
    title: "Écartés à la poulie",
    summary: "Isole les pectoraux avec une tension continue.",
    description:
      "Les poulies gardent les pectoraux sous tension du début à la fin du mouvement, en forme d’étreinte.",
    steps: [
      "Règle les deux poulies à hauteur d’épaules et prends une poignée dans chaque main.",
      "Fais un pas en avant, bras ouverts et coudes légèrement fléchis.",
      "Ramène les mains l’une vers l’autre devant ta poitrine, comme pour enlacer un arbre.",
      "Reviens lentement à la position de départ.",
    ],
    cues: [
      "Garde la même flexion des coudes tout le long.",
      "Serre les pectoraux quand les mains se rejoignent.",
      "Avance légèrement le buste.",
    ],
    mistakes: [
      "Plier et tendre les bras, ce qui transforme l’exercice en développé.",
      "Prendre une charge trop lourde et perdre le contrôle au retour.",
    ],
    muscles: ["chest"],
    places: ["gym"],
    equipment: ["cables"],
    level: "intermediate",
  }),
  exercise("parallel-bar-dip", {
    title: "Dips aux barres parallèles",
    summary: "Un mouvement exigeant pour les pectoraux et les triceps.",
    description:
      "En appui sur deux barres, tu descends et remontes ton corps avec la force des bras et de la poitrine.",
    steps: [
      "Agrippe les barres et monte bras tendus, épaules basses.",
      "Penche légèrement le buste vers l’avant.",
      "Descends en pliant les coudes jusqu’à ce que tes épaules soient à hauteur des coudes.",
      "Pousse pour remonter jusqu’à avoir les bras tendus.",
    ],
    cues: [
      "Garde les épaules loin des oreilles.",
      "Descends seulement aussi bas que tes épaules le permettent sans douleur.",
      "Contrôle la descente.",
    ],
    mistakes: [
      "Descendre trop bas et forcer l’avant des épaules.",
      "Se balancer pour remonter.",
    ],
    muscles: ["chest", "triceps"],
    places: ["gym"],
    equipment: ["bodyweight"],
    level: "intermediate",
  }),
  exercise("pull-up", {
    title: "Tractions",
    summary: "Le meilleur exercice au poids du corps pour le dos.",
    description:
      "Suspendu à une barre, tu tires ton corps vers le haut. Une barre de traction de porte suffit à la maison.",
    steps: [
      "Agrippe la barre en pronation, mains un peu plus larges que les épaules.",
      "Pars suspendu, bras tendus, épaules engagées.",
      "Tire les coudes vers le bas jusqu’à ce que ton menton dépasse la barre.",
      "Redescends lentement jusqu’à avoir les bras tendus.",
    ],
    cues: [
      "Commence le mouvement en abaissant les omoplates.",
      "Garde les jambes immobiles, sans élan.",
      "Pense à amener la poitrine vers la barre.",
    ],
    mistakes: [
      "Se balancer ou donner des coups de jambes.",
      "Ne remonter qu’à moitié.",
    ],
    muscles: ["back", "biceps"],
    places: ["gym", "home"],
    equipment: ["bodyweight"],
    level: "intermediate",
  }),
  exercise("lat-pulldown", {
    title: "Tirage vertical à la poulie",
    summary: "Renforce le dos et prépare aux tractions.",
    description:
      "Assis à la machine, tu tires une barre vers le haut de ta poitrine pour travailler les grands dorsaux.",
    steps: [
      "Règle le coussin pour bloquer tes cuisses.",
      "Prends la barre un peu plus large que les épaules.",
      "Tire la barre vers le haut de la poitrine en abaissant les coudes.",
      "Laisse remonter la barre lentement, bras tendus.",
    ],
    cues: [
      "Garde le buste légèrement incliné vers l’arrière.",
      "Abaisse les épaules avant de plier les coudes.",
      "Serre le dos en bas du mouvement.",
    ],
    mistakes: [
      "Tirer la barre derrière la nuque.",
      "Se pencher loin vers l’arrière pour s’aider.",
    ],
    muscles: ["back", "biceps"],
    places: ["gym"],
    equipment: ["cables", "machine"],
    level: "beginner",
  }),
  exercise("one-arm-dumbbell-row", {
    title: "Rowing à un bras avec haltère",
    summary: "Travaille le dos un côté à la fois.",
    description:
      "Appuyé sur un banc, tu tires un haltère vers ta hanche pour renforcer le milieu du dos.",
    steps: [
      "Pose un genou et une main sur un banc, dos plat.",
      "Prends l’haltère de l’autre main, bras tendu vers le sol.",
      "Tire l’haltère vers ta hanche en gardant le coude près du corps.",
      "Redescends lentement jusqu’à avoir le bras tendu.",
    ],
    cues: [
      "Garde le dos plat comme une table.",
      "Pense à tirer avec le coude, pas avec la main.",
      "Ne tourne pas le buste pour remonter.",
    ],
    mistakes: [
      "Arrondir le dos.",
      "Faire pivoter le tronc pour soulever plus lourd.",
    ],
    muscles: ["back", "biceps"],
    places: ["gym", "home"],
    equipment: ["dumbbells"],
    level: "beginner",
  }),
  exercise("bent-over-barbell-row", {
    title: "Rowing à la barre penché",
    summary: "Un exercice de base pour l’épaisseur du dos.",
    description:
      "Penché vers l’avant, dos plat, tu tires une barre vers ton ventre. Demande une bonne tenue du bas du dos.",
    steps: [
      "Debout, pieds à largeur de hanches, prends la barre un peu plus large que les épaules.",
      "Plie les hanches pour pencher le buste à environ 45 degrés, dos plat, genoux fléchis.",
      "Tire la barre vers le nombril en serrant les omoplates.",
      "Redescends lentement, bras tendus.",
    ],
    cues: [
      "Garde la poitrine ouverte et le dos neutre.",
      "La barre reste près des cuisses.",
      "Le buste ne remonte pas pendant le tirage.",
    ],
    mistakes: [
      "Arrondir le bas du dos.",
      "Se redresser à chaque répétition pour donner de l’élan.",
    ],
    muscles: ["back", "biceps"],
    places: ["gym"],
    equipment: ["barbell"],
    level: "intermediate",
  }),
  exercise("seated-cable-row", {
    title: "Tirage horizontal à la poulie",
    summary: "Renforce le milieu du dos et la posture.",
    description:
      "Assis face à la poulie, tu tires la poignée vers ton ventre en gardant le dos droit.",
    steps: [
      "Assieds-toi, pieds sur les appuis, genoux légèrement fléchis.",
      "Prends la poignée, bras tendus, dos droit.",
      "Tire la poignée vers le bas du ventre en serrant les omoplates.",
      "Laisse revenir la poignée lentement.",
    ],
    cues: [
      "Garde le buste immobile.",
      "Les coudes restent près du corps.",
      "Ouvre la poitrine en fin de mouvement.",
    ],
    mistakes: [
      "Se balancer d’avant en arrière.",
      "Hausser les épaules vers les oreilles.",
    ],
    muscles: ["back", "biceps"],
    places: ["gym"],
    equipment: ["cables"],
    level: "beginner",
  }),
  exercise("deadlift", {
    title: "Soulevé de terre",
    summary: "Un mouvement complet pour tout l’arrière du corps.",
    description:
      "Tu soulèves une barre du sol jusqu’aux hanches. Très efficace, mais la technique passe avant la charge : commence léger, idéalement avec un entraîneur.",
    steps: [
      "Pieds à largeur de hanches, la barre au-dessus du milieu des pieds.",
      "Plie les hanches et les genoux pour prendre la barre, mains juste à l’extérieur des jambes.",
      "Dos plat, poitrine haute, pousse le sol avec les pieds pour te redresser.",
      "Redescends la barre en reculant d’abord les hanches, puis en pliant les genoux.",
    ],
    cues: [
      "La barre reste collée aux jambes tout le long.",
      "Gaine le ventre avant de soulever.",
      "Les hanches et les épaules montent en même temps.",
    ],
    mistakes: [
      "Arrondir le dos pour soulever.",
      "Tirer avec les bras au lieu de pousser avec les jambes.",
      "Se pencher vers l’arrière en haut du mouvement.",
    ],
    muscles: ["back", "hamstrings", "glutes"],
    places: ["gym"],
    equipment: ["barbell"],
    level: "advanced",
  }),
  exercise("superman", {
    title: "Superman",
    summary: "Renforce le bas du dos, sans équipement.",
    description:
      "Allongé sur le ventre, tu lèves les bras et les jambes pour travailler les muscles qui soutiennent la colonne.",
    steps: [
      "Allonge-toi sur le ventre, bras tendus devant toi.",
      "Lève en même temps les bras, la poitrine et les jambes de quelques centimètres.",
      "Tiens deux secondes en serrant les fessiers.",
      "Redescends lentement.",
    ],
    cues: [
      "Regarde le sol pour garder le cou neutre.",
      "Le mouvement est petit et contrôlé.",
      "Respire normalement pendant le maintien.",
    ],
    mistakes: ["Lever trop haut en cambrant fort.", "Donner des à-coups."],
    muscles: ["back", "glutes"],
    places: ["home", "gym"],
    equipment: ["bodyweight"],
    level: "beginner",
  }),
  exercise("dumbbell-shoulder-press", {
    title: "Développé militaire aux haltères",
    summary: "Le mouvement de base pour les épaules.",
    description:
      "Assis ou debout, tu pousses deux haltères au-dessus de ta tête.",
    steps: [
      "Assieds-toi sur un banc avec dossier, haltères à hauteur d’épaules.",
      "Paumes vers l’avant, pousse les haltères vers le haut.",
      "Tends les bras sans verrouiller les coudes.",
      "Redescends lentement à hauteur d’épaules.",
    ],
    cues: [
      "Garde les côtes basses et le ventre gainé.",
      "Les coudes restent légèrement devant le corps.",
      "Expire en poussant.",
    ],
    mistakes: [
      "Cambrer le bas du dos pour pousser.",
      "Descendre les haltères trop bas derrière la tête.",
    ],
    muscles: ["shoulders", "triceps"],
    places: ["gym", "home"],
    equipment: ["dumbbells"],
    level: "beginner",
  }),
  exercise("lateral-raise", {
    title: "Élévations latérales",
    summary: "Isole le côté des épaules.",
    description:
      "Avec des haltères légers, tu lèves les bras sur les côtés jusqu’à hauteur d’épaules.",
    steps: [
      "Debout, un haltère dans chaque main le long du corps.",
      "Coudes légèrement fléchis, lève les bras sur les côtés.",
      "Arrête à hauteur d’épaules.",
      "Redescends lentement.",
    ],
    cues: [
      "Mène le mouvement avec les coudes.",
      "Choisis une charge légère et contrôlée.",
      "Garde les épaules basses.",
    ],
    mistakes: [
      "Balancer le corps pour lever plus lourd.",
      "Monter les mains plus haut que les épaules en haussant les épaules.",
    ],
    muscles: ["shoulders"],
    places: ["gym", "home"],
    equipment: ["dumbbells"],
    level: "beginner",
  }),
  exercise("face-pull", {
    title: "Face pull à la poulie",
    summary: "Renforce l’arrière des épaules et la posture.",
    description:
      "Tu tires une corde vers ton visage en ouvrant les coudes. Idéal pour équilibrer les exercices de poussée.",
    steps: [
      "Règle la poulie à hauteur de visage avec une corde.",
      "Prends la corde paumes vers le bas et recule d’un pas.",
      "Tire la corde vers ton front en écartant les mains.",
      "Reviens lentement, bras tendus.",
    ],
    cues: [
      "Les coudes restent hauts, à hauteur d’épaules.",
      "Serre les omoplates en fin de mouvement.",
      "Garde le buste immobile.",
    ],
    mistakes: [
      "Tirer vers le cou ou la poitrine.",
      "Prendre trop lourd et se pencher vers l’arrière.",
    ],
    muscles: ["shoulders", "back"],
    places: ["gym"],
    equipment: ["cables"],
    level: "beginner",
  }),
  exercise("pike-push-up", {
    title: "Pompes piquées",
    summary: "Les épaules au poids du corps.",
    description:
      "Les hanches hautes, en V inversé, tu descends la tête vers le sol pour travailler les épaules comme un développé.",
    steps: [
      "Pars en position de pompe, puis recule les pieds et monte les hanches en V inversé.",
      "Plie les coudes pour descendre le sommet de la tête vers le sol, entre tes mains.",
      "Arrête juste avant de toucher.",
      "Pousse pour remonter.",
    ],
    cues: [
      "Garde les hanches hautes tout le long.",
      "Les coudes partent vers l’arrière, pas sur les côtés.",
      "Rapproche les pieds pour rendre l’exercice plus difficile.",
    ],
    mistakes: [
      "Laisser descendre les hanches, ce qui en fait une pompe ordinaire.",
      "Descendre trop vite vers le sol.",
    ],
    muscles: ["shoulders", "triceps"],
    places: ["home", "gym"],
    equipment: ["bodyweight"],
    level: "intermediate",
  }),
  exercise("dumbbell-curl", {
    title: "Flexion des biceps aux haltères",
    summary: "L’exercice de base des biceps.",
    description:
      "Debout, tu plies les coudes pour monter les haltères vers les épaules.",
    steps: [
      "Debout, un haltère dans chaque main, paumes vers l’avant.",
      "Garde les coudes collés au corps.",
      "Plie les coudes pour monter les haltères vers les épaules.",
      "Redescends lentement jusqu’à avoir les bras tendus.",
    ],
    cues: [
      "Seuls les avant-bras bougent.",
      "Serre les biceps en haut.",
      "Contrôle la descente.",
    ],
    mistakes: [
      "Balancer le dos pour monter la charge.",
      "Avancer les coudes en haut du mouvement.",
    ],
    muscles: ["biceps"],
    places: ["gym", "home"],
    equipment: ["dumbbells"],
    level: "beginner",
  }),
  exercise("hammer-curl", {
    title: "Curl marteau",
    summary: "Les biceps et les avant-bras, prise neutre.",
    description:
      "Les paumes face à face, tu travailles les biceps et les muscles de l’avant-bras.",
    steps: [
      "Debout, un haltère dans chaque main, paumes face au corps.",
      "Garde les coudes collés.",
      "Monte les haltères vers les épaules sans tourner les poignets.",
      "Redescends lentement.",
    ],
    cues: [
      "Les pouces pointent vers le haut tout le long.",
      "Garde le buste immobile.",
      "Alterne les bras si tu préfères.",
    ],
    mistakes: ["Donner de l’élan avec les hanches.", "Descendre trop vite."],
    muscles: ["biceps"],
    places: ["gym", "home"],
    equipment: ["dumbbells"],
    level: "beginner",
  }),
  exercise("triceps-pushdown", {
    title: "Extension des triceps à la poulie",
    summary: "Isole l’arrière des bras.",
    description:
      "Face à la poulie haute, tu pousses la barre ou la corde vers le bas en gardant les coudes fixes.",
    steps: [
      "Règle la poulie en haut avec une barre ou une corde.",
      "Coudes collés au corps, avant-bras à l’horizontale.",
      "Pousse vers le bas jusqu’à avoir les bras tendus.",
      "Remonte lentement jusqu’à l’horizontale.",
    ],
    cues: [
      "Les coudes ne bougent pas.",
      "Serre les triceps en bas.",
      "Garde les épaules basses.",
    ],
    mistakes: [
      "Se pencher sur la barre pour pousser avec le poids du corps.",
      "Laisser les coudes s’écarter.",
    ],
    muscles: ["triceps"],
    places: ["gym"],
    equipment: ["cables"],
    level: "beginner",
  }),
  exercise("chair-dip", {
    title: "Dips sur une chaise",
    summary: "Les triceps à la maison.",
    description:
      "En appui sur une chaise stable ou un banc, tu descends et remontes ton corps avec les bras.",
    steps: [
      "Assieds-toi au bord d’une chaise stable, mains à côté des hanches.",
      "Avance les fesses hors de la chaise, jambes pliées.",
      "Plie les coudes vers l’arrière pour descendre jusqu’à environ 90 degrés.",
      "Pousse pour remonter.",
    ],
    cues: [
      "Garde le dos près de la chaise.",
      "Les coudes pointent vers l’arrière.",
      "Tends les jambes pour rendre l’exercice plus difficile.",
    ],
    mistakes: [
      "Descendre trop bas et forcer les épaules.",
      "Utiliser une chaise qui glisse ou bascule.",
    ],
    muscles: ["triceps"],
    places: ["home"],
    equipment: ["bodyweight"],
    level: "beginner",
  }),
  exercise("band-curl", {
    title: "Flexion des biceps avec élastique",
    summary: "Les biceps avec un élastique, partout.",
    description:
      "Un pied sur l’élastique, tu plies les coudes comme avec des haltères. La tension augmente en haut du mouvement.",
    steps: [
      "Place le milieu de l’élastique sous tes pieds.",
      "Prends une extrémité dans chaque main, paumes vers l’avant.",
      "Plie les coudes pour monter les mains vers les épaules.",
      "Redescends lentement.",
    ],
    cues: [
      "Coudes collés au corps.",
      "Raccourcis l’élastique pour plus de résistance.",
      "Contrôle le retour.",
    ],
    mistakes: [
      "Laisser l’élastique ramener les bras d’un coup.",
      "Se pencher vers l’arrière.",
    ],
    muscles: ["biceps"],
    places: ["home"],
    equipment: ["bands"],
    level: "beginner",
  }),
  exercise("bodyweight-squat", {
    title: "Squat au poids du corps",
    summary: "Le mouvement de base des jambes.",
    description:
      "Tu t’assois vers l’arrière comme sur une chaise, puis tu te relèves. Travaille les cuisses et les fessiers.",
    steps: [
      "Debout, pieds à largeur d’épaules, orteils légèrement vers l’extérieur.",
      "Pousse les hanches vers l’arrière et plie les genoux.",
      "Descends jusqu’à avoir les cuisses parallèles au sol, ou aussi bas que confortable.",
      "Pousse dans les talons pour te relever.",
    ],
    cues: [
      "Les genoux suivent la direction des orteils.",
      "Garde la poitrine haute.",
      "Le poids reste sur tout le pied.",
    ],
    mistakes: [
      "Laisser les genoux rentrer vers l’intérieur.",
      "Décoller les talons.",
    ],
    muscles: ["quads", "glutes"],
    places: ["home", "gym"],
    equipment: ["bodyweight"],
    level: "beginner",
  }),
  exercise("barbell-back-squat", {
    title: "Squat à la barre",
    summary: "L’exercice roi pour la force des jambes.",
    description:
      "La barre sur le haut du dos, tu fais un squat complet. Utilise une cage avec des appuis de sécurité.",
    steps: [
      "Place la barre sur le haut du dos, sous la base du cou, dans la cage.",
      "Décroche la barre et recule de deux pas, pieds à largeur d’épaules.",
      "Gaine le ventre, puis descends en poussant les hanches vers l’arrière.",
      "Remonte en poussant le sol, dos droit.",
    ],
    cues: [
      "Prends une grande inspiration avant de descendre.",
      "Les genoux suivent les orteils.",
      "Garde le dos neutre du début à la fin.",
    ],
    mistakes: [
      "Arrondir le dos en bas du mouvement.",
      "Soulever lourd sans appuis de sécurité.",
    ],
    muscles: ["quads", "glutes", "core"],
    places: ["gym"],
    equipment: ["barbell"],
    level: "intermediate",
  }),
  exercise("goblet-squat", {
    title: "Squat gobelet",
    summary: "Le squat chargé le plus facile à apprendre.",
    description:
      "Tu tiens un haltère ou un kettlebell contre ta poitrine, ce qui aide à garder le buste droit.",
    steps: [
      "Tiens la charge à deux mains contre ta poitrine.",
      "Pieds un peu plus larges que les épaules.",
      "Descends entre tes jambes, coudes vers l’intérieur des genoux.",
      "Remonte en poussant dans les talons.",
    ],
    cues: [
      "Garde la charge collée à la poitrine.",
      "Pousse les genoux vers l’extérieur.",
      "Le dos reste droit.",
    ],
    mistakes: [
      "Laisser la charge s’éloigner du corps.",
      "Pencher le buste vers l’avant.",
    ],
    muscles: ["quads", "glutes"],
    places: ["gym", "home"],
    equipment: ["dumbbells", "kettlebell"],
    level: "beginner",
  }),
  exercise("forward-lunge", {
    title: "Fentes avant",
    summary: "Les jambes une à la fois, et l’équilibre.",
    description:
      "Tu fais un grand pas vers l’avant et descends le genou arrière vers le sol.",
    steps: [
      "Debout, pieds à largeur de hanches.",
      "Fais un grand pas vers l’avant.",
      "Descends jusqu’à ce que les deux genoux soient à environ 90 degrés.",
      "Pousse sur le pied avant pour revenir, puis change de jambe.",
    ],
    cues: [
      "Le genou avant reste au-dessus de la cheville.",
      "Garde le buste droit.",
      "Ajoute des haltères quand c’est facile.",
    ],
    mistakes: [
      "Faire un pas trop court, ce qui charge le genou.",
      "Laisser le genou avant rentrer vers l’intérieur.",
    ],
    muscles: ["quads", "glutes"],
    places: ["home", "gym"],
    equipment: ["bodyweight", "dumbbells"],
    level: "beginner",
  }),
  exercise("bulgarian-split-squat", {
    title: "Fentes bulgares",
    summary: "Une fente exigeante, le pied arrière surélevé.",
    description:
      "Le pied arrière posé sur un banc, la jambe avant fait presque tout le travail.",
    steps: [
      "Dos à un banc, pose le dessus d’un pied dessus.",
      "Avance l’autre pied d’un grand pas.",
      "Descends le genou arrière vers le sol.",
      "Remonte en poussant sur le talon avant, puis change de jambe.",
    ],
    cues: [
      "Garde le buste légèrement penché vers l’avant.",
      "Le genou avant suit les orteils.",
      "Commence sans charge.",
    ],
    mistakes: [
      "Placer le pied avant trop près du banc.",
      "Pousser avec la jambe arrière.",
    ],
    muscles: ["quads", "glutes"],
    places: ["gym", "home"],
    equipment: ["bodyweight", "dumbbells"],
    level: "intermediate",
  }),
  exercise("dumbbell-romanian-deadlift", {
    title: "Soulevé de terre roumain aux haltères",
    summary: "L’arrière des cuisses et les fessiers.",
    description:
      "Tu penches le buste vers l’avant en reculant les hanches, jambes presque tendues, pour étirer puis contracter l’arrière des cuisses.",
    steps: [
      "Debout, un haltère dans chaque main devant les cuisses.",
      "Genoux légèrement fléchis, recule les hanches.",
      "Descends les haltères le long des jambes jusqu’à sentir l’étirement.",
      "Remonte en poussant les hanches vers l’avant.",
    ],
    cues: [
      "Le dos reste plat.",
      "Les haltères frôlent les jambes.",
      "Le mouvement vient des hanches, pas du dos.",
    ],
    mistakes: [
      "Arrondir le dos pour descendre plus bas.",
      "Plier beaucoup les genoux, ce qui en fait un squat.",
    ],
    muscles: ["hamstrings", "glutes"],
    places: ["gym", "home"],
    equipment: ["dumbbells"],
    level: "intermediate",
  }),
  exercise("leg-press", {
    title: "Presse à cuisses",
    summary: "Les jambes avec le dos bien soutenu.",
    description:
      "Assis à la machine, tu pousses une plateforme avec les pieds. Une bonne façon de charger les jambes sans charger le dos.",
    steps: [
      "Assieds-toi, dos et tête appuyés, pieds à largeur d’épaules sur la plateforme.",
      "Débloque la plateforme.",
      "Plie les genoux pour la descendre vers toi jusqu’à environ 90 degrés.",
      "Pousse pour tendre les jambes sans verrouiller les genoux.",
    ],
    cues: [
      "Le bas du dos reste collé au dossier.",
      "Les genoux suivent les orteils.",
      "Pousse avec tout le pied.",
    ],
    mistakes: [
      "Verrouiller les genoux en haut.",
      "Descendre si bas que les fesses décollent.",
    ],
    muscles: ["quads", "glutes"],
    places: ["gym"],
    equipment: ["machine"],
    level: "beginner",
  }),
  exercise("glute-bridge", {
    title: "Pont fessier",
    summary: "Les fessiers, couché au sol.",
    description:
      "Couché sur le dos, tu soulèves les hanches en serrant les fessiers.",
    steps: [
      "Allonge-toi sur le dos, genoux pliés, pieds à plat.",
      "Pousse dans les talons pour soulever les hanches.",
      "Monte jusqu’à former une ligne des genoux aux épaules.",
      "Serre les fessiers une seconde, puis redescends.",
    ],
    cues: [
      "Garde le ventre gainé.",
      "Pousse avec les talons.",
      "Ne cambre pas en haut.",
    ],
    mistakes: ["Pousser avec le bas du dos.", "Écarter les genoux."],
    muscles: ["glutes", "hamstrings"],
    places: ["home", "gym"],
    equipment: ["bodyweight"],
    level: "beginner",
  }),
  exercise("barbell-hip-thrust", {
    title: "Hip thrust à la barre",
    summary: "Le meilleur exercice chargé pour les fessiers.",
    description:
      "Le haut du dos appuyé sur un banc, tu soulèves une barre posée sur tes hanches. Utilise un coussin sous la barre.",
    steps: [
      "Assieds-toi au sol, le haut du dos contre un banc, la barre sur les hanches.",
      "Pieds à plat, à largeur de hanches.",
      "Pousse dans les talons pour monter les hanches jusqu’à l’horizontale.",
      "Redescends lentement.",
    ],
    cues: [
      "Rentre le menton et regarde devant toi.",
      "Les tibias sont verticaux en haut.",
      "Serre les fessiers en haut.",
    ],
    mistakes: [
      "Cambrer le dos au lieu de monter avec les fessiers.",
      "Placer les pieds trop loin.",
    ],
    muscles: ["glutes"],
    places: ["gym"],
    equipment: ["barbell"],
    level: "intermediate",
  }),
  exercise("standing-calf-raise", {
    title: "Mollets debout",
    summary: "Renforce les mollets.",
    description:
      "Debout sur une marche, tu montes sur la pointe des pieds puis redescends lentement.",
    steps: [
      "Place l’avant des pieds sur une marche, talons dans le vide.",
      "Tiens-toi à un mur pour l’équilibre.",
      "Monte sur la pointe des pieds le plus haut possible.",
      "Redescends lentement sous le niveau de la marche.",
    ],
    cues: [
      "Fais une pause en haut.",
      "Descends sur trois secondes.",
      "Ajoute un haltère quand c’est facile.",
    ],
    mistakes: ["Rebondir en bas.", "Plier les genoux."],
    muscles: ["calves"],
    places: ["home", "gym"],
    equipment: ["bodyweight", "dumbbells"],
    level: "beginner",
  }),
  exercise("machine-leg-curl", {
    title: "Leg curl à la machine",
    summary: "Isole l’arrière des cuisses.",
    description:
      "Couché ou assis à la machine, tu plies les genoux contre une résistance.",
    steps: [
      "Règle la machine pour que le coussin soit juste au-dessus des talons.",
      "Plie les genoux en ramenant les talons vers les fesses.",
      "Serre l’arrière des cuisses une seconde.",
      "Reviens lentement.",
    ],
    cues: [
      "Les hanches restent collées au banc.",
      "Contrôle le retour.",
      "Garde les pieds fléchis.",
    ],
    mistakes: [
      "Soulever les hanches pour s’aider.",
      "Laisser la charge retomber.",
    ],
    muscles: ["hamstrings"],
    places: ["gym"],
    equipment: ["machine"],
    level: "beginner",
  }),
  exercise("plank", {
    title: "Planche",
    summary: "Le gainage de base pour un tronc solide.",
    description:
      "En appui sur les avant-bras et les orteils, tu gardes ton corps droit le plus longtemps possible.",
    steps: [
      "Pose les avant-bras au sol, coudes sous les épaules.",
      "Tends les jambes, en appui sur les orteils.",
      "Aligne la tête, le dos et les talons.",
      "Tiens la position en respirant calmement.",
    ],
    cues: [
      "Serre les fessiers et le ventre.",
      "Pousse le sol avec les avant-bras.",
      "Arrête quand la position se dégrade.",
    ],
    mistakes: ["Laisser les hanches tomber.", "Monter les fesses trop haut."],
    muscles: ["core"],
    places: ["home", "gym"],
    equipment: ["bodyweight"],
    level: "beginner",
  }),
  exercise("side-plank", {
    title: "Planche latérale",
    summary: "Le gainage des côtés du tronc.",
    description:
      "En appui sur un avant-bras, de côté, tu gardes le corps en ligne droite.",
    steps: [
      "Couche-toi sur le côté, coude sous l’épaule.",
      "Empile les pieds l’un sur l’autre.",
      "Soulève les hanches pour former une ligne droite.",
      "Tiens, puis change de côté.",
    ],
    cues: [
      "Pousse le sol avec l’avant-bras.",
      "Garde les hanches hautes.",
      "Pose le genou du dessous pour simplifier.",
    ],
    mistakes: [
      "Laisser les hanches s’affaisser.",
      "Pencher le buste vers l’avant.",
    ],
    muscles: ["core"],
    places: ["home", "gym"],
    equipment: ["bodyweight"],
    level: "beginner",
  }),
  exercise("crunch", {
    title: "Crunch",
    summary: "Les abdominaux, couché au sol.",
    description:
      "Tu enroules le haut du dos pour rapprocher les côtes du bassin.",
    steps: [
      "Allonge-toi sur le dos, genoux pliés, pieds à plat.",
      "Croise les bras sur la poitrine ou mets les mains derrière les oreilles.",
      "Enroule le haut du dos pour décoller les omoplates.",
      "Redescends lentement.",
    ],
    cues: [
      "Le bas du dos reste au sol.",
      "Expire en montant.",
      "Le mouvement est court.",
    ],
    mistakes: ["Tirer sur la nuque avec les mains.", "Monter avec l’élan."],
    muscles: ["core"],
    places: ["home", "gym"],
    equipment: ["bodyweight"],
    level: "beginner",
  }),
  exercise("hanging-leg-raise", {
    title: "Relevés de jambes suspendu",
    summary: "Les abdominaux, version avancée.",
    description:
      "Suspendu à une barre, tu montes les jambes devant toi sans te balancer.",
    steps: [
      "Suspends-toi à une barre, bras tendus.",
      "Gaine le ventre pour ne pas te balancer.",
      "Monte les jambes tendues (ou les genoux) jusqu’à l’horizontale.",
      "Redescends lentement.",
    ],
    cues: [
      "Enroule le bassin en haut.",
      "Commence avec les genoux pliés.",
      "Contrôle la descente.",
    ],
    mistakes: [
      "Se balancer pour monter les jambes.",
      "Laisser tomber les jambes.",
    ],
    muscles: ["core"],
    places: ["gym", "home"],
    equipment: ["bodyweight"],
    level: "advanced",
  }),
  exercise("mountain-climbers", {
    title: "Mountain climbers",
    summary: "Gainage et cardio en même temps.",
    description:
      "En position de pompe, tu ramènes les genoux vers la poitrine en alternance, rapidement.",
    steps: [
      "Pars en position de pompe, bras tendus.",
      "Ramène un genou vers la poitrine.",
      "Change de jambe en sautant légèrement.",
      "Continue à un rythme régulier.",
    ],
    cues: [
      "Les épaules restent au-dessus des mains.",
      "Garde les hanches basses.",
      "Commence lentement, puis accélère.",
    ],
    mistakes: ["Monter les fesses.", "Perdre l’alignement en accélérant."],
    muscles: ["core", "fullBody"],
    places: ["home", "gym"],
    equipment: ["bodyweight"],
    level: "beginner",
  }),
  exercise("kettlebell-swing", {
    title: "Kettlebell swing",
    summary: "La puissance des hanches et le cardio.",
    description:
      "Tu balances un kettlebell entre tes jambes puis jusqu’à hauteur de poitrine, avec la force des hanches. Apprends le mouvement léger.",
    steps: [
      "Pieds un peu plus larges que les épaules, le kettlebell devant toi.",
      "Recule les hanches et prends-le à deux mains.",
      "Fais-le passer entre tes jambes, puis pousse les hanches vers l’avant.",
      "Laisse-le monter à hauteur de poitrine, puis redescendre entre tes jambes.",
    ],
    cues: [
      "Les bras guident, les hanches poussent.",
      "Le dos reste plat.",
      "Serre les fessiers en haut.",
    ],
    mistakes: [
      "Soulever avec les bras.",
      "Faire un squat au lieu de reculer les hanches.",
      "Arrondir le dos en bas.",
    ],
    muscles: ["glutes", "hamstrings", "fullBody"],
    places: ["gym", "home"],
    equipment: ["kettlebell"],
    level: "intermediate",
  }),
];

// --- Recettes (30) ----------------------------------------------------------

const RECIPES: SeedItem[] = [
  recipe("protein-oatmeal", {
    title: "Gruau crémeux aux petits fruits",
    summary: "Un déjeuner chaud, rassasiant et riche en protéines.",
    description:
      "Le yogourt grec ajouté à la fin rend le gruau crémeux et augmente les protéines.",
    ingredients: [
      "125 ml (1/2 tasse) de flocons d’avoine",
      "250 ml (1 tasse) de lait",
      "125 ml (1/2 tasse) de yogourt grec nature",
      "125 ml (1/2 tasse) de petits fruits",
      "15 ml (1 c. à soupe) de graines de chia",
      "5 ml (1 c. à thé) de sirop d’érable",
    ],
    steps: [
      "Fais chauffer le lait et l’avoine à feu moyen 4 à 5 minutes en brassant.",
      "Retire du feu et incorpore le yogourt grec.",
      "Garnis de petits fruits, de graines de chia et de sirop d’érable.",
    ],
    minutes: 10,
    servings: 1,
    meals: ["breakfast"],
    goals: ["muscleGain", "maintenance"],
    diets: ["vegetarian"],
    // L'avoine peut contenir du gluten (contamination croisée)
    allergens: ["milk", "wheat"],
  }),
  recipe("veggie-omelette", {
    title: "Omelette aux légumes et feta",
    summary: "Rapide, faible en glucides et riche en protéines.",
    description: "Une omelette colorée prête en dix minutes.",
    ingredients: [
      "3 œufs",
      "1/2 poivron rouge en dés",
      "1 poignée d’épinards",
      "1/4 d’oignon haché",
      "30 g de feta émiettée",
      "5 ml (1 c. à thé) d’huile d’olive",
      "Sel et poivre",
    ],
    steps: [
      "Fais revenir l’oignon et le poivron dans l’huile 3 minutes.",
      "Ajoute les épinards jusqu’à ce qu’ils tombent.",
      "Verse les œufs battus, laisse prendre à feu moyen.",
      "Parsème de feta, plie l’omelette et sers.",
    ],
    minutes: 10,
    servings: 1,
    meals: ["breakfast", "lunch"],
    goals: ["weightLoss", "maintenance"],
    diets: ["vegetarian"],
    allergens: ["eggs", "milk"],
  }),
  recipe("protein-french-toast", {
    title: "Pain doré protéiné",
    summary: "Un classique du brunch, plus nourrissant.",
    description:
      "Des tranches de pain de grains entiers trempées dans un mélange d’œufs et de lait.",
    ingredients: [
      "2 tranches de pain de grains entiers",
      "2 œufs",
      "60 ml (1/4 tasse) de lait",
      "2 ml (1/2 c. à thé) de cannelle",
      "125 ml (1/2 tasse) de fruits frais",
      "5 ml (1 c. à thé) de beurre",
    ],
    steps: [
      "Fouette les œufs, le lait et la cannelle.",
      "Trempe chaque tranche des deux côtés.",
      "Fais dorer dans le beurre 2 à 3 minutes par côté.",
      "Sers avec les fruits.",
    ],
    minutes: 15,
    servings: 1,
    meals: ["breakfast"],
    goals: ["muscleGain", "maintenance"],
    diets: ["vegetarian"],
    allergens: ["wheat", "eggs", "milk"],
  }),
  recipe("banana-peanut-smoothie", {
    title: "Smoothie banane et beurre d’arachide",
    summary: "Beaucoup d’énergie pour prendre de la masse.",
    description:
      "Un smoothie dense en calories et en protéines, idéal après l’entraînement.",
    ingredients: [
      "1 banane congelée",
      "250 ml (1 tasse) de lait",
      "30 ml (2 c. à soupe) de beurre d’arachide",
      "30 ml (2 c. à soupe) de flocons d’avoine",
      "125 ml (1/2 tasse) de yogourt grec",
    ],
    steps: [
      "Mets tous les ingrédients dans le mélangeur.",
      "Mélange jusqu’à ce que ce soit lisse.",
      "Ajoute un peu de lait si c’est trop épais.",
    ],
    minutes: 5,
    servings: 1,
    meals: ["breakfast", "snack"],
    goals: ["muscleGain"],
    diets: ["vegetarian"],
    allergens: ["milk", "peanuts", "wheat"],
  }),
  recipe("yogurt-parfait", {
    title: "Parfait yogourt, granola et fruits",
    summary: "Un déjeuner sans cuisson, prêt en deux minutes.",
    description:
      "Des couches de yogourt grec, de granola et de fruits. Choisis un granola sans noix si besoin.",
    ingredients: [
      "175 ml (3/4 tasse) de yogourt grec nature",
      "60 ml (1/4 tasse) de granola",
      "125 ml (1/2 tasse) de fruits frais",
      "5 ml (1 c. à thé) de miel",
    ],
    steps: [
      "Verse la moitié du yogourt dans un verre.",
      "Ajoute la moitié des fruits et du granola.",
      "Recommence, puis termine avec le miel.",
    ],
    minutes: 5,
    servings: 1,
    meals: ["breakfast", "snack"],
    goals: ["maintenance", "muscleGain"],
    diets: ["vegetarian"],
    // La plupart des granolas contiennent de l'avoine et des noix
    allergens: ["milk", "wheat", "treeNuts"],
  }),
  recipe("chia-pudding", {
    title: "Pouding de chia au lait d’amande",
    summary: "Prépare-le la veille, mange-le le matin.",
    description:
      "Les graines de chia gonflent pendant la nuit et donnent une texture de pouding.",
    ingredients: [
      "45 ml (3 c. à soupe) de graines de chia",
      "250 ml (1 tasse) de boisson d’amande",
      "5 ml (1 c. à thé) de sirop d’érable",
      "2 ml (1/2 c. à thé) de vanille",
      "125 ml (1/2 tasse) de mangue en dés",
    ],
    steps: [
      "Mélange les graines de chia, la boisson d’amande, le sirop et la vanille.",
      "Brasse de nouveau après 5 minutes.",
      "Laisse reposer au frigo au moins 4 heures.",
      "Garnis de mangue avant de servir.",
    ],
    minutes: 5,
    servings: 1,
    meals: ["breakfast", "snack"],
    goals: ["weightLoss", "maintenance"],
    diets: ["vegetarian", "vegan"],
    allergens: ["treeNuts"],
  }),
  recipe("tofu-scramble", {
    title: "Tofu brouillé aux légumes",
    summary: "L’équivalent végane des œufs brouillés.",
    description: "Le curcuma donne la couleur, les légumes donnent le volume.",
    ingredients: [
      "200 g de tofu ferme",
      "1/2 poivron en dés",
      "1 poignée d’épinards",
      "2 ml (1/2 c. à thé) de curcuma",
      "1 pincée de poudre d’ail",
      "5 ml (1 c. à thé) d’huile d’olive",
      "Sel et poivre",
    ],
    steps: [
      "Émiette le tofu avec une fourchette.",
      "Fais revenir le poivron dans l’huile 3 minutes.",
      "Ajoute le tofu, le curcuma et l’ail, et cuis 5 minutes.",
      "Ajoute les épinards jusqu’à ce qu’ils tombent.",
    ],
    minutes: 15,
    servings: 1,
    meals: ["breakfast", "lunch"],
    goals: ["weightLoss", "maintenance"],
    diets: ["vegetarian", "vegan"],
    allergens: ["soy"],
  }),
  recipe("banana-egg-pancakes", {
    title: "Crêpes banane et œufs",
    summary: "Deux ingrédients, sans farine.",
    description:
      "Des petites crêpes naturellement sucrées, faites seulement de banane et d’œufs.",
    ingredients: [
      "1 banane mûre",
      "2 œufs",
      "1 pincée de cannelle",
      "5 ml (1 c. à thé) d’huile",
    ],
    steps: [
      "Écrase la banane, puis fouette-la avec les œufs et la cannelle.",
      "Chauffe une poêle huilée à feu moyen-doux.",
      "Verse de petites crêpes et cuis 1 à 2 minutes par côté.",
    ],
    minutes: 10,
    servings: 1,
    meals: ["breakfast"],
    goals: ["weightLoss", "maintenance"],
    diets: ["vegetarian"],
    allergens: ["eggs"],
  }),
  recipe("chicken-quinoa-salad", {
    title: "Salade de poulet grillé et quinoa",
    summary: "Un dîner complet qui se prépare d’avance.",
    description:
      "Protéines, grains entiers et légumes croquants, dans un bol qui se garde trois jours au frigo.",
    ingredients: [
      "120 g de poitrine de poulet cuite",
      "125 ml (1/2 tasse) de quinoa cuit",
      "1/2 concombre en dés",
      "6 tomates cerises",
      "15 ml (1 c. à soupe) d’huile d’olive",
      "Le jus de 1/2 citron",
      "Sel, poivre, persil",
    ],
    steps: [
      "Coupe le poulet en lanières.",
      "Mélange le quinoa, le concombre et les tomates.",
      "Arrose d’huile et de citron, assaisonne.",
      "Ajoute le poulet et le persil.",
    ],
    minutes: 15,
    servings: 1,
    meals: ["lunch"],
    goals: ["weightLoss", "maintenance"],
    allergens: [],
  }),
  recipe("tuna-wrap", {
    title: "Wrap au thon",
    summary: "Un dîner à emporter en cinq minutes.",
    description: "Une tortilla de blé entier garnie de thon et de crudités.",
    ingredients: [
      "1 tortilla de blé entier",
      "1 boîte (120 g) de thon égoutté",
      "15 ml (1 c. à soupe) de mayonnaise",
      "1 feuille de laitue",
      "1/4 de poivron en lanières",
      "Poivre",
    ],
    steps: [
      "Mélange le thon et la mayonnaise, poivre.",
      "Étale sur la tortilla avec la laitue et le poivron.",
      "Roule serré et coupe en deux.",
    ],
    minutes: 5,
    servings: 1,
    meals: ["lunch"],
    goals: ["maintenance", "muscleGain"],
    allergens: ["fish", "wheat", "eggs"],
  }),
  recipe("salmon-rice-bowl", {
    title: "Bol de riz au saumon",
    summary: "Un bol inspiré du poke, plein de protéines.",
    description:
      "Du saumon cuit, du riz, de l’edamame et une sauce soya au sésame.",
    ingredients: [
      "120 g de saumon cuit",
      "175 ml (3/4 tasse) de riz cuit",
      "60 ml (1/4 tasse) d’edamames",
      "1/2 avocat",
      "15 ml (1 c. à soupe) de sauce soya",
      "5 ml (1 c. à thé) d’huile de sésame",
      "5 ml (1 c. à thé) de graines de sésame",
    ],
    steps: [
      "Mets le riz au fond du bol.",
      "Ajoute le saumon, les edamames et l’avocat.",
      "Arrose de sauce soya et d’huile de sésame.",
      "Parsème de graines de sésame.",
    ],
    minutes: 15,
    servings: 1,
    meals: ["lunch", "dinner"],
    goals: ["muscleGain", "maintenance"],
    // La sauce soya contient souvent du blé
    allergens: ["fish", "soy", "wheat", "sesame"],
  }),
  recipe("bean-chili", {
    title: "Chili végétarien aux haricots",
    summary: "Un grand chaudron à congeler en portions.",
    description:
      "Riche en fibres et en protéines végétales, encore meilleur le lendemain.",
    ingredients: [
      "2 boîtes (540 ml) de haricots rouges rincés",
      "1 boîte (796 ml) de tomates en dés",
      "1 oignon haché",
      "1 poivron en dés",
      "2 gousses d’ail",
      "15 ml (1 c. à soupe) d’assaisonnement au chili",
      "15 ml (1 c. à soupe) d’huile d’olive",
    ],
    steps: [
      "Fais revenir l’oignon, le poivron et l’ail dans l’huile 5 minutes.",
      "Ajoute l’assaisonnement, les tomates et les haricots.",
      "Laisse mijoter 25 minutes en brassant de temps en temps.",
    ],
    minutes: 40,
    servings: 4,
    meals: ["lunch", "dinner"],
    goals: ["weightLoss", "maintenance"],
    diets: ["vegetarian", "vegan"],
    allergens: [],
  }),
  recipe("lentil-soup", {
    title: "Soupe aux lentilles",
    summary: "Réconfortante, économique et rassasiante.",
    description:
      "Des lentilles et des légumes qui mijotent ensemble. Vérifie le bouillon : certains contiennent des allergènes.",
    ingredients: [
      "250 ml (1 tasse) de lentilles vertes rincées",
      "1 oignon haché",
      "2 carottes en dés",
      "2 branches de céleri en dés",
      "1,5 L (6 tasses) de bouillon de légumes",
      "5 ml (1 c. à thé) de cumin",
      "15 ml (1 c. à soupe) d’huile d’olive",
    ],
    steps: [
      "Fais revenir l’oignon, les carottes et le céleri dans l’huile 5 minutes.",
      "Ajoute le cumin, les lentilles et le bouillon.",
      "Laisse mijoter 30 minutes, jusqu’à ce que les lentilles soient tendres.",
    ],
    minutes: 45,
    servings: 4,
    meals: ["lunch", "dinner"],
    goals: ["weightLoss", "maintenance"],
    diets: ["vegetarian", "vegan"],
    allergens: [],
  }),
  recipe("chickpea-salad", {
    title: "Salade méditerranéenne aux pois chiches",
    summary: "Fraîche, croquante et prête en dix minutes.",
    description:
      "Des pois chiches, des légumes et de la feta dans une vinaigrette au citron.",
    ingredients: [
      "1 boîte (540 ml) de pois chiches rincés",
      "1 concombre en dés",
      "1 tasse de tomates cerises coupées",
      "1/4 d’oignon rouge haché",
      "60 g de feta",
      "30 ml (2 c. à soupe) d’huile d’olive",
      "Le jus de 1 citron",
    ],
    steps: [
      "Mélange les pois chiches et les légumes.",
      "Fouette l’huile et le citron, assaisonne.",
      "Verse sur la salade et ajoute la feta.",
    ],
    minutes: 10,
    servings: 2,
    meals: ["lunch"],
    goals: ["weightLoss", "maintenance"],
    diets: ["vegetarian"],
    allergens: ["milk"],
  }),
  recipe("turkey-avocado-sandwich", {
    title: "Sandwich dinde et avocat",
    summary: "Un sandwich équilibré pour la boîte à lunch.",
    description:
      "De la dinde, de l’avocat et des crudités sur du pain de grains entiers.",
    ingredients: [
      "2 tranches de pain de grains entiers",
      "80 g de dinde cuite tranchée",
      "1/4 d’avocat écrasé",
      "5 ml (1 c. à thé) de moutarde de Dijon",
      "Laitue et tranches de tomate",
    ],
    steps: [
      "Étale l’avocat sur une tranche et la moutarde sur l’autre.",
      "Ajoute la dinde, la laitue et la tomate.",
      "Referme et coupe en deux.",
    ],
    minutes: 5,
    servings: 1,
    meals: ["lunch"],
    goals: ["maintenance"],
    allergens: ["wheat", "mustard"],
  }),
  recipe("tofu-poke-bowl", {
    title: "Poke au tofu",
    summary: "Un bol végane coloré et protéiné.",
    description:
      "Du tofu doré, du riz et des légumes croquants avec une sauce soya au sésame.",
    ingredients: [
      "150 g de tofu ferme en cubes",
      "175 ml (3/4 tasse) de riz cuit",
      "60 ml (1/4 tasse) d’edamames",
      "1/2 carotte râpée",
      "1/4 de concombre en tranches",
      "15 ml (1 c. à soupe) de sauce soya",
      "5 ml (1 c. à thé) d’huile de sésame",
    ],
    steps: [
      "Fais dorer le tofu dans une poêle 6 à 8 minutes.",
      "Mets le riz au fond du bol, puis le tofu et les légumes.",
      "Arrose de sauce soya et d’huile de sésame.",
    ],
    minutes: 20,
    servings: 1,
    meals: ["lunch", "dinner"],
    goals: ["maintenance", "muscleGain"],
    diets: ["vegetarian", "vegan"],
    allergens: ["soy", "wheat", "sesame"],
  }),
  recipe("chicken-sweet-potato", {
    title: "Poulet, patate douce et brocoli",
    summary: "Le repas de base des sportifs, tout sur une plaque.",
    description:
      "Tout cuit en même temps au four : simple à préparer en lot pour la semaine.",
    ingredients: [
      "150 g de poitrine de poulet",
      "1 patate douce en cubes",
      "250 ml (1 tasse) de bouquets de brocoli",
      "15 ml (1 c. à soupe) d’huile d’olive",
      "5 ml (1 c. à thé) de paprika",
      "Sel et poivre",
    ],
    steps: [
      "Préchauffe le four à 200 °C (400 °F).",
      "Mélange la patate douce avec la moitié de l’huile et cuis 15 minutes.",
      "Ajoute le poulet assaisonné et le brocoli huilé.",
      "Cuis encore 18 à 20 minutes, jusqu’à ce que le poulet soit cuit.",
    ],
    minutes: 40,
    servings: 1,
    meals: ["dinner"],
    goals: ["muscleGain", "maintenance"],
    allergens: [],
  }),
  recipe("baked-salmon-asparagus", {
    title: "Saumon au four et asperges",
    summary: "Un souper léger et riche en oméga-3.",
    description: "Le saumon et les asperges cuisent ensemble en 15 minutes.",
    ingredients: [
      "150 g de filet de saumon",
      "1 botte d’asperges",
      "15 ml (1 c. à soupe) d’huile d’olive",
      "1/2 citron en tranches",
      "Aneth, sel et poivre",
    ],
    steps: [
      "Préchauffe le four à 200 °C (400 °F).",
      "Dépose le saumon et les asperges sur une plaque, arrose d’huile.",
      "Assaisonne et ajoute le citron et l’aneth.",
      "Cuis 12 à 15 minutes.",
    ],
    minutes: 20,
    servings: 1,
    meals: ["dinner"],
    goals: ["weightLoss", "maintenance"],
    allergens: ["fish"],
  }),
  recipe("turkey-bolognese", {
    title: "Spaghetti bolognaise à la dinde",
    summary: "Le plat réconfort, en version plus maigre.",
    description: "Une sauce à la dinde hachée sur des pâtes de blé entier.",
    ingredients: [
      "300 g de dinde hachée",
      "1 pot (650 ml) de sauce tomate",
      "1 oignon haché",
      "2 gousses d’ail",
      "250 g de spaghettis de blé entier",
      "30 ml (2 c. à soupe) de parmesan râpé",
    ],
    steps: [
      "Fais cuire les pâtes selon l’emballage.",
      "Fais revenir l’oignon et l’ail, puis ajoute la dinde jusqu’à ce qu’elle soit cuite.",
      "Ajoute la sauce et laisse mijoter 10 minutes.",
      "Sers sur les pâtes avec le parmesan.",
    ],
    minutes: 30,
    servings: 3,
    meals: ["dinner"],
    goals: ["muscleGain", "maintenance"],
    allergens: ["wheat", "milk"],
  }),
  recipe("beef-stir-fry", {
    title: "Sauté de bœuf et légumes",
    summary: "Un souper rapide au wok.",
    description:
      "Du bœuf tranché et des légumes croquants dans une sauce soya, servis sur du riz.",
    ingredients: [
      "200 g de bœuf en lanières",
      "1 poivron en lanières",
      "250 ml (1 tasse) de brocoli",
      "30 ml (2 c. à soupe) de sauce soya",
      "1 gousse d’ail",
      "5 ml (1 c. à thé) de gingembre râpé",
      "15 ml (1 c. à soupe) d’huile",
      "375 ml (1 1/2 tasse) de riz cuit",
    ],
    steps: [
      "Saisis le bœuf dans l’huile chaude 2 minutes, puis retire-le.",
      "Fais sauter les légumes, l’ail et le gingembre 4 minutes.",
      "Remets le bœuf, ajoute la sauce soya et mélange 1 minute.",
      "Sers sur le riz.",
    ],
    minutes: 20,
    servings: 2,
    meals: ["dinner"],
    goals: ["muscleGain"],
    allergens: ["soy", "wheat"],
  }),
  recipe("fish-tacos", {
    title: "Tacos de poisson",
    summary: "Des tacos légers avec une sauce crémeuse.",
    description:
      "Du poisson blanc grillé dans des tortillas de maïs, avec du chou et une sauce au yogourt.",
    ingredients: [
      "200 g de poisson blanc (aiglefin, tilapia)",
      "4 tortillas de maïs",
      "250 ml (1 tasse) de chou émincé",
      "60 ml (1/4 tasse) de yogourt grec",
      "Le jus de 1 lime",
      "5 ml (1 c. à thé) d’assaisonnement au chili",
    ],
    steps: [
      "Assaisonne le poisson et cuis-le à la poêle 3 minutes par côté.",
      "Mélange le yogourt et la moitié du jus de lime.",
      "Réchauffe les tortillas.",
      "Garnis de poisson, de chou et de sauce, puis arrose de lime.",
    ],
    minutes: 20,
    servings: 2,
    meals: ["dinner"],
    goals: ["weightLoss", "maintenance"],
    allergens: ["fish", "milk"],
  }),
  recipe("chickpea-curry", {
    title: "Cari de pois chiches au lait de coco",
    summary: "Un cari doux, végane et parfumé.",
    description:
      "Des pois chiches et des épinards dans une sauce au lait de coco, servis sur du riz.",
    ingredients: [
      "1 boîte (540 ml) de pois chiches rincés",
      "1 boîte (400 ml) de lait de coco léger",
      "1 oignon haché",
      "2 gousses d’ail",
      "15 ml (1 c. à soupe) de cari en poudre",
      "2 tasses d’épinards",
      "500 ml (2 tasses) de riz cuit",
    ],
    steps: [
      "Fais revenir l’oignon et l’ail 4 minutes.",
      "Ajoute le cari, puis les pois chiches et le lait de coco.",
      "Laisse mijoter 15 minutes, puis ajoute les épinards.",
      "Sers sur le riz.",
    ],
    minutes: 30,
    servings: 3,
    meals: ["dinner", "lunch"],
    goals: ["maintenance", "muscleGain"],
    diets: ["vegetarian", "vegan"],
    allergens: [],
  }),
  recipe("turkey-burger", {
    title: "Burger de dinde maison",
    summary: "Un burger plus maigre, fait à la maison.",
    description:
      "Des galettes de dinde assaisonnées, cuites à la poêle ou au BBQ.",
    ingredients: [
      "400 g de dinde hachée",
      "1 œuf",
      "60 ml (1/4 tasse) de chapelure",
      "1 gousse d’ail hachée",
      "4 pains à burger de blé entier",
      "Laitue, tomate et oignon",
    ],
    steps: [
      "Mélange la dinde, l’œuf, la chapelure et l’ail.",
      "Forme 4 galettes.",
      "Cuis 5 à 6 minutes par côté, jusqu’à ce qu’elles soient bien cuites.",
      "Garnis les pains de laitue, de tomate et d’oignon.",
    ],
    minutes: 25,
    servings: 4,
    meals: ["dinner"],
    goals: ["muscleGain", "maintenance"],
    allergens: ["eggs", "wheat"],
  }),
  recipe("garlic-shrimp-pasta", {
    title: "Pâtes aux crevettes et à l’ail",
    summary: "Un souper rapide aux saveurs de la mer.",
    description:
      "Des crevettes sautées à l’ail sur des pâtes, avec un peu de parmesan.",
    ingredients: [
      "200 g de crevettes décortiquées",
      "200 g de linguines",
      "3 gousses d’ail émincées",
      "30 ml (2 c. à soupe) d’huile d’olive",
      "1 pincée de flocons de piment",
      "30 ml (2 c. à soupe) de parmesan",
      "Persil",
    ],
    steps: [
      "Fais cuire les pâtes.",
      "Fais revenir l’ail et le piment dans l’huile 1 minute.",
      "Ajoute les crevettes et cuis 3 minutes.",
      "Mélange avec les pâtes, le parmesan et le persil.",
    ],
    minutes: 20,
    servings: 2,
    meals: ["dinner"],
    goals: ["maintenance"],
    allergens: ["shellfish", "wheat", "milk"],
  }),
  recipe("tempeh-bowl", {
    title: "Bol de tempeh et légumes rôtis",
    summary: "Un bol végane riche en protéines.",
    description:
      "Du tempeh, du quinoa et des légumes rôtis, avec une sauce au tahini.",
    ingredients: [
      "150 g de tempeh en cubes",
      "125 ml (1/2 tasse) de quinoa cuit",
      "1 tasse de légumes (courgette, poivron, oignon rouge)",
      "15 ml (1 c. à soupe) d’huile d’olive",
      "15 ml (1 c. à soupe) de tahini",
      "Le jus de 1/2 citron",
    ],
    steps: [
      "Préchauffe le four à 200 °C (400 °F).",
      "Mélange le tempeh et les légumes avec l’huile, rôtis 20 minutes.",
      "Délaie le tahini avec le citron et un peu d’eau.",
      "Sers sur le quinoa avec la sauce.",
    ],
    minutes: 30,
    servings: 1,
    meals: ["dinner", "lunch"],
    goals: ["muscleGain", "maintenance"],
    diets: ["vegetarian", "vegan"],
    allergens: ["soy", "sesame"],
  }),
  recipe("energy-balls", {
    title: "Boules d’énergie dattes et avoine",
    summary: "Une collation à préparer pour la semaine.",
    description: "Des bouchées sans cuisson, parfaites avant l’entraînement.",
    ingredients: [
      "250 ml (1 tasse) de dattes dénoyautées",
      "250 ml (1 tasse) de flocons d’avoine",
      "60 ml (1/4 tasse) de beurre d’arachide",
      "15 ml (1 c. à soupe) de cacao",
      "1 pincée de sel",
    ],
    steps: [
      "Trempe les dattes 10 minutes dans l’eau chaude, puis égoutte-les.",
      "Mélange tous les ingrédients au robot.",
      "Forme 12 boules et garde-les au frigo.",
    ],
    minutes: 20,
    servings: 12,
    meals: ["snack"],
    goals: ["muscleGain", "maintenance"],
    diets: ["vegetarian", "vegan"],
    allergens: ["peanuts", "wheat"],
  }),
  recipe("hummus-veggies", {
    title: "Houmous et crudités",
    summary: "Une collation croquante et rassasiante.",
    description: "Un houmous maison avec des légumes coupés.",
    ingredients: [
      "1 boîte (540 ml) de pois chiches rincés",
      "45 ml (3 c. à soupe) de tahini",
      "Le jus de 1 citron",
      "1 gousse d’ail",
      "30 ml (2 c. à soupe) d’huile d’olive",
      "Carottes, concombre et poivron en bâtonnets",
    ],
    steps: [
      "Mets les pois chiches, le tahini, le citron, l’ail et l’huile au robot.",
      "Ajoute un peu d’eau jusqu’à obtenir une texture lisse.",
      "Sers avec les crudités.",
    ],
    minutes: 10,
    servings: 4,
    meals: ["snack"],
    goals: ["weightLoss", "maintenance"],
    diets: ["vegetarian", "vegan"],
    allergens: ["sesame"],
  }),
  recipe("cottage-pineapple", {
    title: "Fromage cottage et ananas",
    summary: "Une collation riche en protéines, sans cuisson.",
    description: "Le fromage cottage et le fruit, tout simplement.",
    ingredients: [
      "175 ml (3/4 tasse) de fromage cottage",
      "125 ml (1/2 tasse) d’ananas en morceaux",
      "1 pincée de cannelle",
    ],
    steps: [
      "Mets le fromage cottage dans un bol.",
      "Ajoute l’ananas et la cannelle.",
    ],
    minutes: 2,
    servings: 1,
    meals: ["snack"],
    goals: ["weightLoss", "muscleGain"],
    diets: ["vegetarian"],
    allergens: ["milk"],
  }),
  recipe("apple-almond-butter", {
    title: "Pomme et beurre d’amande",
    summary: "La collation de deux minutes.",
    description:
      "Des tranches de pomme avec du beurre d’amande pour une collation équilibrée.",
    ingredients: [
      "1 pomme en tranches",
      "15 ml (1 c. à soupe) de beurre d’amande",
    ],
    steps: ["Coupe la pomme en tranches.", "Sers avec le beurre d’amande."],
    minutes: 2,
    servings: 1,
    meals: ["snack"],
    goals: ["maintenance", "weightLoss"],
    diets: ["vegetarian", "vegan"],
    allergens: ["treeNuts"],
  }),
  recipe("boiled-eggs-veggies", {
    title: "Œufs durs et légumes",
    summary: "Une collation protéinée à préparer d’avance.",
    description: "Des œufs durs cuits pour la semaine, avec des légumes.",
    ingredients: ["2 œufs", "Concombre et tomates cerises", "Sel et poivre"],
    steps: [
      "Plonge les œufs dans l’eau bouillante 10 minutes.",
      "Refroidis-les dans l’eau froide, puis écale-les.",
      "Sers avec les légumes.",
    ],
    minutes: 15,
    servings: 1,
    meals: ["snack"],
    goals: ["weightLoss", "maintenance"],
    diets: ["vegetarian"],
    allergens: ["eggs"],
  }),
];

// --- Outils (20) ------------------------------------------------------------

const TOOLS: SeedItem[] = [
  tool("box-breathing", "mental", {
    title: "Respiration carrée",
    summary: "Calme le système nerveux en quatre minutes.",
    description:
      "Une respiration en quatre temps égaux, utilisée pour retrouver son calme avant un moment stressant.",
    steps: [
      "Assieds-toi le dos droit et expire tout l’air.",
      "Inspire par le nez en comptant jusqu’à 4.",
      "Retiens ton souffle en comptant jusqu’à 4.",
      "Expire par la bouche en comptant jusqu’à 4.",
      "Reste poumons vides en comptant jusqu’à 4, puis recommence pendant 4 minutes.",
    ],
    minutes: 4,
    themes: ["stress", "emotions"],
  }),
  tool("cardiac-coherence", "mental", {
    title: "Cohérence cardiaque",
    summary: "Cinq minutes de respiration lente pour faire baisser le stress.",
    description:
      "Respirer six fois par minute pendant cinq minutes aide à réguler le rythme cardiaque et le stress. À faire jusqu’à trois fois par jour.",
    steps: [
      "Installe-toi confortablement, les pieds au sol.",
      "Inspire lentement pendant 5 secondes.",
      "Expire lentement pendant 5 secondes.",
      "Continue ce rythme pendant 5 minutes.",
    ],
    minutes: 5,
    themes: ["stress", "emotions", "focus"],
  }),
  tool("body-scan", "mental", {
    title: "Balayage corporel",
    summary: "Relâcher les tensions, de la tête aux pieds.",
    description:
      "Une méditation guidée par ton attention, qui parcourt le corps pour relâcher les tensions. Utile avant de dormir.",
    steps: [
      "Allonge-toi et ferme les yeux.",
      "Porte ton attention sur tes pieds, remarque les sensations.",
      "Monte lentement vers les jambes, le ventre, le dos, les épaules et le visage.",
      "Sur chaque zone tendue, expire en la laissant se relâcher.",
      "Termine par trois grandes respirations.",
    ],
    minutes: 10,
    themes: ["stress", "sleep"],
  }),
  tool("two-minute-rule", "mental", {
    title: "La règle des deux minutes",
    summary: "Démarrer une habitude en la rendant ridiculement facile.",
    description:
      "Le plus dur est de commencer. Réduis ta nouvelle habitude à une version qui prend deux minutes, et fais-la chaque jour.",
    steps: [
      "Choisis une habitude que tu repousses.",
      "Réduis-la à deux minutes (lire une page, enfiler tes espadrilles).",
      "Fais cette version chaque jour, à la même heure.",
      "Quand c’est automatique, allonge-la petit à petit.",
    ],
    minutes: 2,
    themes: ["discipline"],
  }),
  tool("pomodoro", "mental", {
    title: "Technique Pomodoro",
    summary: "Se concentrer par blocs de 25 minutes.",
    description:
      "Alterner 25 minutes de travail sans distraction et 5 minutes de pause aide à rester concentré longtemps.",
    steps: [
      "Choisis une seule tâche.",
      "Mets ton téléphone hors de vue et lance une minuterie de 25 minutes.",
      "Travaille sans t’interrompre jusqu’à la sonnerie.",
      "Prends 5 minutes de pause, puis recommence.",
      "Après quatre blocs, prends une pause de 20 minutes.",
    ],
    minutes: 25,
    themes: ["focus", "discipline"],
  }),
  tool("plan-tomorrow", "mental", {
    title: "Planifier sa journée la veille",
    summary: "Trois priorités, choisies le soir.",
    description:
      "Décider le soir de ce qui compte demain évite de commencer la journée en réagissant à tout.",
    steps: [
      "Le soir, prends 10 minutes et une feuille.",
      "Écris les trois choses qui feraient de demain une bonne journée.",
      "Place-les dans ton horaire, la plus importante en premier.",
      "Le lendemain, commence par la première avant d’ouvrir tes messages.",
    ],
    minutes: 10,
    themes: ["discipline", "focus"],
  }),
  tool("gratitude-journal", "mental", {
    title: "Journal de gratitude",
    summary: "Trois bonnes choses, chaque soir.",
    description:
      "Noter chaque soir trois choses positives entraîne l’attention à remarquer ce qui va bien.",
    steps: [
      "Chaque soir, ouvre ton journal.",
      "Écris trois choses qui se sont bien passées aujourd’hui.",
      "Pour chacune, ajoute pourquoi elle est arrivée.",
      "Relis la semaine le dimanche.",
    ],
    minutes: 5,
    themes: ["emotions", "confidence"],
  }),
  tool("sleep-routine", "mental", {
    title: "Routine du coucher",
    summary: "Préparer son cerveau à dormir.",
    description:
      "Des heures régulières et une routine calme avant de dormir améliorent la qualité du sommeil.",
    steps: [
      "Choisis une heure de coucher et de lever fixes, même la fin de semaine.",
      "30 minutes avant, éteins les écrans et tamise la lumière.",
      "Fais une activité calme (lecture, étirements, respiration).",
      "Garde la chambre fraîche, sombre et silencieuse.",
    ],
    minutes: 30,
    themes: ["sleep", "stress"],
  }),
  tool("reframe-thought", "mental", {
    title: "Recadrer une pensée négative",
    summary: "Examiner une pensée au lieu de la croire.",
    description:
      "Une technique inspirée de la thérapie cognitive pour remettre une pensée difficile en perspective.",
    steps: [
      "Écris la situation et la pensée qui t’est venue.",
      "Note l’émotion et son intensité sur 10.",
      "Écris les faits pour et contre cette pensée.",
      "Formule une pensée plus juste et plus équilibrée.",
      "Note de nouveau l’intensité de l’émotion.",
    ],
    minutes: 10,
    themes: ["confidence", "emotions", "stress"],
  }),
  tool("name-the-emotion", "mental", {
    title: "Nommer l’émotion",
    summary: "Mettre un mot sur ce qu’on ressent pour l’apaiser.",
    description:
      "Nommer précisément une émotion aide à en réduire l’intensité et à mieux choisir sa réaction.",
    steps: [
      "Arrête-toi et prends une respiration.",
      "Demande-toi ce que tu ressens, le plus précisément possible.",
      "Dis-le dans ta tête ou à voix basse (« je me sens frustré »).",
      "Repère où tu le sens dans ton corps.",
      "Choisis ensuite ce que tu veux faire.",
    ],
    minutes: 3,
    themes: ["emotions"],
  }),
  tool("conversation-opener", "social", {
    title: "Ouvrir une conversation",
    summary: "Une observation et une question ouverte.",
    description:
      "Commencer par une observation sur ce que vous partagez, puis poser une question ouverte, rend le premier contact naturel.",
    steps: [
      "Remarque quelque chose que vous avez en commun (le lieu, l’événement, l’activité).",
      "Fais une observation simple à voix haute.",
      "Enchaîne avec une question ouverte (« comment tu as connu… »).",
      "Écoute la réponse et rebondis sur un détail.",
    ],
    minutes: 5,
    themes: ["meetPeople", "communication"],
  }),
  tool("active-listening", "social", {
    title: "Écoute active",
    summary: "Faire sentir à l’autre qu’il est vraiment entendu.",
    description:
      "Écouter pour comprendre, et non pour répondre, renforce la confiance dans toutes les relations.",
    steps: [
      "Range ton téléphone et regarde la personne.",
      "Laisse-la terminer sans l’interrompre.",
      "Reformule ce que tu as compris (« si je comprends bien… »).",
      "Pose une question pour aller plus loin.",
    ],
    minutes: 10,
    themes: ["communication", "relationships"],
  }),
  tool("reconnect-message", "social", {
    title: "Message de reconnexion",
    summary: "Reprendre contact avec quelqu’un en trois phrases.",
    description:
      "Un court message sincère suffit souvent à raviver un lien perdu de vue.",
    steps: [
      "Choisis une personne à qui tu n’as pas parlé depuis longtemps.",
      "Écris un souvenir ou une raison précise de penser à elle.",
      "Ajoute une question sur sa vie.",
      "Propose un moment simple (un café, un appel).",
    ],
    minutes: 5,
    themes: ["relationships", "networking"],
  }),
  tool("elevator-pitch", "social", {
    title: "Préparer sa présentation de 30 secondes",
    summary: "Savoir dire qui on est, simplement.",
    description:
      "Une présentation courte et claire aide à se présenter avec assurance en réseautage.",
    steps: [
      "Écris qui tu es et ce que tu fais en une phrase.",
      "Ajoute ce qui te passionne ou ce que tu cherches.",
      "Termine par une question pour l’autre personne.",
      "Répète-la à voix haute jusqu’à ce qu’elle soit naturelle.",
    ],
    minutes: 15,
    themes: ["networking", "publicSpeaking"],
  }),
  tool("follow-up-questions", "social", {
    title: "Trois questions de suivi",
    summary: "Garder une conversation vivante.",
    description:
      "Poser trois questions de suivi sur le même sujet montre un vrai intérêt et approfondit l’échange.",
    steps: [
      "Quand la personne parle d’un sujet, reste dessus.",
      "Pose une première question de suivi (« comment ça s’est passé? »).",
      "Puis une deuxième, sur ce qu’elle a ressenti.",
      "Puis une troisième, sur la suite.",
    ],
    minutes: 5,
    themes: ["networking", "meetPeople", "communication"],
  }),
  tool("i-statements", "social", {
    title: "Exprimer un besoin au « je »",
    summary: "Dire ce qui ne va pas sans attaquer.",
    description:
      "Inspirée de la communication non violente, cette façon de parler évite que l’autre se sente accusé.",
    steps: [
      "Décris le fait, sans jugement (« quand tu arrives en retard… »).",
      "Dis ce que tu ressens (« je me sens… »).",
      "Explique ton besoin (« parce que j’ai besoin de… »).",
      "Fais une demande claire et réalisable.",
    ],
    minutes: 5,
    themes: ["communication", "relationships"],
  }),
  tool("speech-practice", "social", {
    title: "S’exercer à parler en public",
    summary: "S’enregistrer pour progresser.",
    description:
      "S’enregistrer en vidéo est le moyen le plus rapide de repérer ses tics et de gagner en aisance.",
    steps: [
      "Choisis un sujet que tu connais bien.",
      "Enregistre-toi deux minutes avec ton téléphone.",
      "Regarde la vidéo et note une chose à améliorer.",
      "Recommence en te concentrant sur ce seul point.",
    ],
    minutes: 15,
    themes: ["publicSpeaking"],
  }),
  tool("social-ladder", "social", {
    title: "L’échelle des défis sociaux",
    summary: "Sortir de sa zone de confort une marche à la fois.",
    description:
      "Classer les situations sociales de la plus facile à la plus difficile, puis les affronter dans l’ordre, fait baisser l’anxiété.",
    steps: [
      "Écris dix situations sociales qui te rendent mal à l’aise.",
      "Classe-les de la plus facile à la plus difficile.",
      "Fais la plus facile cette semaine.",
      "Passe à la suivante quand elle devient confortable.",
    ],
    minutes: 10,
    themes: ["meetPeople"],
  }),
  tool("weekly-social-plan", "social", {
    title: "Une activité sociale par semaine",
    summary: "Planifier ses liens comme le reste.",
    description:
      "Les amitiés demandent du temps : réserver une activité par semaine les garde vivantes.",
    steps: [
      "Le dimanche, choisis une personne ou un groupe.",
      "Propose une activité précise avec une date.",
      "Ajoute-la à ton calendrier.",
      "Après, note ce que tu as aimé.",
    ],
    minutes: 10,
    themes: ["relationships", "meetPeople"],
  }),
  tool("stage-fright", "social", {
    title: "Gérer le trac avant de parler",
    summary: "Deux minutes pour arriver calme.",
    description:
      "Une respiration lente et un ancrage dans le corps juste avant de parler réduisent les effets du trac.",
    steps: [
      "Pose les deux pieds bien à plat au sol.",
      "Expire plus longtemps que tu inspires, cinq fois.",
      "Relâche les épaules et la mâchoire.",
      "Rappelle-toi ta première phrase et ton message principal.",
    ],
    minutes: 2,
    themes: ["publicSpeaking"],
  }),
];

/** Tout le contenu de départ, dans l'ordre d'import. */
export const SEED_ITEMS: readonly SeedItem[] = [
  ...EXERCISES,
  ...RECIPES,
  ...TOOLS,
];
