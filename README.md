# Okulist 👁️

**Auto-dépistage visuel dans le navigateur, calibré sur votre écran.**

Okulist est une page web autonome (un seul fichier HTML, zéro dépendance) qui enchaîne
neuf tests de dépistage visuel, puis propose les réglages macOS les plus utiles selon
vos résultats.

> ⚠️ **Okulist est un outil indicatif, pas un dispositif médical.** Il ne mesure pas
> votre réfraction et ne remplace ni un examen ophtalmologique ni des lunettes.
> Aucun filtre logiciel ne peut corriger optiquement une myopie, une hypermétropie
> ou un astigmatisme. En cas de doute ou de résultat anormal, consultez un
> ophtalmologiste ou un orthoptiste.

## Les tests

| Test | Principe | Dépiste |
|---|---|---|
| Calibrage | Carte bancaire (85,6 mm) posée contre l'écran → px/mm réels | — |
| Acuité de loin (par œil) | Anneaux de Landolt normalisés, échelle en dixièmes | Baisse d'acuité |
| Duochrome rouge/vert (par œil) | Netteté comparée sur fonds rouge et vert | Tendance myopique / hypermétropique |
| Cadran d'astigmatisme (par œil) | Lignes rayonnantes d'épaisseur identique | Astigmatisme |
| Sensibilité au contraste | Anneau de Landolt à contraste décroissant (jusqu'à 1,5 %) | Baisse de contraste |
| Vision de près à 40 cm | Lignes de texte de taille millimétrée décroissante | Presbytie |
| Grille d'Amsler (par œil) | Grille 10 × 10 cm, fixation centrale | Anomalies maculaires |
| Vision des couleurs | Planches à points générées façon Ishihara + planche témoin | Déficience rouge-vert |
| Fatigue visuelle numérique | Questionnaire en 6 items | Fatigue / sécheresse oculaire |

Le bilan final classe chaque résultat (OK / à surveiller / consultez) et génère une
liste de réglages macOS marqués « Pour vous » : résolution « Texte plus grand »,
zoom ctrl + molette, contraste renforcé, taille du texte, filtres de couleur,
pointeur agrandi, Night Shift, règle 20-20-20…

## Utilisation

Ouvrez simplement `index.html` dans un navigateur :

```sh
open index.html
```

Aucun serveur, aucune dépendance, aucun réseau requis (hormis les polices Google Fonts,
avec repli sur les polices système). Les résultats restent en local
(`localStorage` du navigateur) — rien n'est envoyé nulle part.

### Conseils pour un test fiable

- Luminosité de l'écran au maximum confortable, écran propre, sans reflets.
- Night Shift / True Tone désactivés le temps du test.
- Une carte bancaire pour le calibrage, un mètre pour la distance si possible.
- Testez **sans** vos lunettes : c'est la vision non corrigée qu'on évalue pour régler l'écran.

## Technique

- Un seul fichier, HTML + CSS + JavaScript vanilla.
- Optotypes : anneaux de Landolt SVG aux proportions normalisées (ouverture = trait = ⅕ du diamètre) ;
  taille calculée à partir de l'angle visuel (1′ d'arc à 10/10) via le calibrage px/mm et la distance déclarée.
- Planches couleur générées à la volée sur `<canvas>` (luminance égalisée entre figure et fond,
  planche témoin pour détecter un écran non interprétable).
- Thèmes clair et sombre ; les surfaces de test restent volontairement blanches (condition photopique).

## Licence

[MIT](LICENSE)
