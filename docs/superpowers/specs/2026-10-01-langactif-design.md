# LangActif : Design

Date : 2026-10-01
Statut : validé par JF le 2026-10-01, prêt pour le plan d'implémentation
Nom : LangActif (définitif, sous-domaine cible `langactif.jfb4plai.com`)

## 1. Contexte et objectif

Apprentissage asynchrone, sur GSM et ordinateur, du **vocabulaire** de langues étrangères par les élèves du secondaire des écoles coopérantes. Langues v1 : **anglais (UK)** et **néerlandais de Belgique (flamand)**. Sens : français vers langue cible (FR vers L) et langue cible vers français (L vers FR).

Usage central : **remédiation**. L'enseignant, mais aussi un remédiateur qui ne parle pas forcément la langue, doit voir précisément ce qui n'est pas acquis et agir.

Contraintes non négociables (JF) :

1. Tableau de bord pour suivre les résultats et adapter les remédiations.
2. Ludique sans être infantilisant, look attractif (référence de ton : Wordwall), mode jeu de temps en temps.
3. Les deux sens, avec option de n'en travailler qu'un.
4. Plusieurs modes : flashcards avec Leitner et audio, QCM avec audio, saisie avec bouton Valider et audio (réponses enregistrées), association de plusieurs mots, roue de lettres (WOW de LexiActif), et autres jeux utiles.
5. Partage par QR code et lien, pseudo par élève (RGPD).

Principes PLAI : inclusion réelle (élèves DYS, TDAH), IA = amplificateur (l'enseignant valide et personnalise), contexte FWB et exemples belges, aucune référence scientifique non vérifiée dans RISS.

## 2. Décisions de conception

| # | Sujet | Décision |
|---|---|---|
| 1 | Contenu | Listes issues des chapitres du manuel, créées ou importées par l'enseignant (Excel), partageables entre écoles |
| 2 | Parcours élève | Libre ou guidé, au choix de l'enseignant par assignation |
| 3 | Remédiation | Proposée par l'app, validée et modifiée par l'enseignant ou le remédiateur, jamais automatique. Mode libre « mes mots difficiles » pour l'élève |
| 4 | Identité élève | Pseudo plus code personnel généré (continuité GSM / PC) |
| 5 | Audio | Pré-généré à l'import et mis en cache, voix de Dialogue Audio (`nl-BE-DenaNeural`, `nl-BE-ArnaudNeural`, `en-GB`) |
| 6 | Réponses saisies | Journal complet des réponses tapées. Pas d'enregistrement vocal en v1 |
| 7 | Rôles | Enseignant, remédiateur (lecture et validation), bibliothèque partagée entre écoles |
| 8 | Périmètre v1 | 7 modes (voir section 6), phrases à trou et dialogue audio en v1.1 |
| 9 | Style visuel | Élève : style B (tuiles pop sur fond clair). Arcade : style A (néon sombre). Enseignant : style C (sobre, teal PLAI) |
| 10 | Sens | Une carte Leitner par mot et par sens. Assignation : un sens, deux sens ou mixte |
| 11 | Motivation | Progression personnelle et objectif collectif de classe. Pas de classement |
| 12 | Intégration | App autonome, réutilisation ciblée de LexiActif et Dialogue Audio. HubActif possible plus tard |
| 13 | Blocs d'évaluation | Regroupement de chapitres : mode révision et mode test blanc, jamais certificatif |
| 14 | Correction | Trois verdicts : juste, presque, faux |
| 15 | Stockage | Journal des réponses plus état Leitner calculé |

## 3. Architecture

- React 18, Vite 5, Tailwind v3, Supabase v2 (RLS), Vercel avec fonctions `/api/*`. Test local avec `vercel dev`.
- PWA mobile first : installable, file de réponses locale, synchronisation au retour du réseau.
- Deux interfaces : élève (style B, arcade A) et enseignant/remédiateur (style C). CSS partagé PLAI (`plai-style.css`), logo PLAI avec hauteur fixée seulement.
- Dépôt GitHub `jfb4plai/LangActif`, branche `main`, Vercel relié. Dépôt à créer au démarrage de l'implémentation, sur github.com par JF (pas de GitHub CLI ni de jeton dans l'environnement ; le `git push` fonctionne ensuite via les identifiants en cache).
- Supabase partagé : toutes les tables préfixées `lang_`. Contrôle de conflit effectué le 2026-10-01 (aucun `create table lang_` existant). Grants Data API explicites dans chaque migration, en plus de RLS.
- Fonctions `api/*.ts` autonomes (pas d'import entre fichiers), code partagé recopié par script de synchronisation, comme dans LexiActif.

## 4. Contenu

### 4.1 Hiérarchie

Langue, puis chapitre, puis liste, puis mot. Un mot porte : forme française, forme cible, traductions acceptées, article ou genre, phrase exemple (facultative), audio du mot, audio de la phrase.

### 4.2 Classeur Excel

Un classeur par chapitre.

- Feuille **Méta** : langue (en-GB, nl-BE), niveau, titre du chapitre, numéro, auteur, date.
- Une feuille par **liste**. Colonnes : `fr`, `cible`, `article` (de/het, vide en anglais), `synonymes_fr` et `synonymes_cible` (séparés par `;`), `phrase_cible`, `phrase_fr`, `audio_url` (facultatif).
- Validation à l'import : rapport d'erreurs ligne par ligne (mot manquant, doublon, article absent en néerlandais, synonyme mal formé). Rien n'est importé tant que le rapport n'est pas propre.
- Modèle téléchargeable dans l'app, avec aide sous chaque colonne.

### 4.3 Aide IA (facultative)

Proposition de phrases exemples et de synonymes, toujours dans une zone modifiable. Consigne : niveau du chapitre, mots déjà connus, contexte belge, traduction française. Jamais enregistré sans relecture de l'enseignant (split 80/20).

### 4.4 Blocs-jeux

Calculés, non stockés comme contenu :

- bloc **liste** ;
- bloc **chapitre** (somme des listes) ;
- bloc **regroupement** (chapitres choisis), avec modes révision et test blanc ;
- bloc **remédiation** (mots et élèves validés).

### 4.5 Bibliothèque partagée

Publier un classeur pour les écoles coopérantes. Les autres l'utilisent par copie adaptable ; l'original reste intact (auteur, date, version).

## 5. Moteur d'apprentissage

### 5.1 Unité de suivi

La **carte** est un mot dans un sens. « fiets, FR vers NL » et « fiets, NL vers FR » progressent indépendamment.

### 5.2 Leitner à 5 boîtes

| Boîte | Revoir après |
|---|---|
| 1 | le jour même ou le lendemain |
| 2 | 2 jours |
| 3 | 4 jours |
| 4 | 7 jours |
| 5 | 14 jours |

- Juste : monte d'une boîte. Faux : retour en boîte 1. Presque : reste dans sa boîte, l'élève retape, erreur classée « orthographe ».
- **Mot maîtrisé = boîte 4 ou 5.** Cet indicateur alimente tableau de bord, points et objectif de classe.
- Nouvelles cartes introduites par lots (5 à 8 par séance, réglable).
- « Juste avec aide » (bouton « Voir dans une phrase » utilisé) : ni montée ni retour.
- Les intervalles sont une heuristique de départ, réglables plus tard (voir section 16, la littérature consultée n'établit pas d'avantage d'un calendrier précis).

### 5.3 Plafond selon le type de tâche

Proposition à confirmer (hypothèse pédagogique, voir section 16) :

| Mode | Boîte maximale |
|---|---|
| Flashcards (auto-évaluation), QCM audio, association, arcade A (tir) | 3 |
| Roue de lettres sans leurres | 3 |
| Roue de lettres avec leurres | 4 |
| Taper la réponse, arcade C (défense) | 5 |

### 5.4 Correction des réponses tapées

- **Juste** : identique, ou synonyme prévu dans le classeur.
- **Presque** : faute d'orthographe proche ou accent. On montre la bonne forme, l'élève la retape.
- **Faux** : le reste. Bonne réponse et audio montrés.
- Vers le français : accents et majuscules tolérés par défaut. Vers la langue cible : strict avec verdict « presque ». Réglable par assignation.

### 5.5 Types d'erreur (journalisés)

Orthographe proche, mauvais article (de/het), confusion avec un autre mot de la liste, sans réponse (temps écoulé), autre.

### 5.6 Journal et état

- **Journal** : une ligne par réponse : élève, carte, mode, bloc, date, latence, texte tapé, verdict, type d'erreur, marqueur test blanc, identifiant unique (synchronisation sans doublon).
- **État Leitner** : recalculé à partir du journal à chaque synchronisation, dans l'ordre des horodatages (cohérent après usage sur deux appareils).
- **Test blanc** : réponses journalisées avec marqueur, alimentent la remédiation, ne modifient pas les boîtes.
- **Conservation** : détail complet 90 jours, puis agrégation par mot, sens et semaine. Durée à ajuster selon la place restante sur le Supabase partagé (non vérifiée).
- **Points** : un point par passage en boîte 4. Objectif de classe : somme des mots maîtrisés. Jamais de points pour la vitesse.

## 6. Les 7 modes

| Mode | Fonctionnement |
|---|---|
| Flashcards plus audio | Retourner la carte, « je savais / je ne savais pas », audio sur les deux faces |
| QCM audio | Écouter ou lire, 4 tuiles, distracteurs de la même liste, ordre mélangé |
| Association | Relier 5 à 6 mots à leurs traductions |
| Taper la réponse | Audio facultatif, clavier, bouton Valider, trois verdicts |
| Roue de lettres (WOW) | Voir 5.3 et 6.1 |
| Arcade A, tir | Viser la bonne traduction parmi des cibles qui flottent |
| Arcade C, défense | Taper la traduction pour détruire le mot qui descend |

### 6.1 Roue de lettres

Réutilise le moteur de LexiActif (`gameEngine.ts`, `languages.ts`).

- FR vers cible : mot français affiché, reconstruction du mot cible. Audio cible débloqué une fois le mot trouvé.
- Cible vers FR : audio du mot cible, reconstruction de la traduction française (ajouter les lettres accentuées françaises aux leurres).
- Leurres facultatifs (+1, +2). Retour qualifié « n lettres sur m bien placées » sans dire lesquelles.
- Mots éligibles : mots simples d'environ 10 lettres ou moins. Expressions et mots longs exclus automatiquement, avec message à l'enseignant.
- L'**article** (de/het) est demandé à part par deux tuiles, il n'entre pas dans la roue.

### 6.2 Arcade

- Parties de 60 à 90 secondes. A : tir au doigt ou à la souris. C : frappe.
- Vitesse réglable (calme, normale, rapide), fixée par défaut par l'enseignant, modifiable par l'élève. Option « sans vie perdue ». Option « réduire les effets ».
- L'enseignant peut désactiver C pour un élève ou une classe. A reste alors seul arcade.
- Meilleur score personnel uniquement, aucun classement.

### 6.3 Phrase exemple

- **Après la réponse (FR vers cible)** : phrase affichée avec audio, traduction masquée à toucher. Sans phrase, le mot seul s'affiche.
- **Dans la question (cible vers FR)** : bouton « Voir dans une phrase », jamais affiché d'office. Réponse donnée avec ce bouton = « juste avec aide ».
- Réglage d'assignation pour désactiver.

### 6.4 Règles transversales

- Après chaque réponse : bonne réponse affichée et audio rejouable, jamais une simple croix rouge.
- Bouton « écouter plus lentement » dans tous les modes.
- Arial, 16 px minimum, jamais la couleur seule (icône et texte aussi), grandes cibles tactiles, pas de mur de texte.
- Modes de saisie : FR vers cible par défaut. Sens selon l'assignation, ou libre en accès libre.

## 7. Parcours élève

- Entrée : lien ou QR de classe, puis pseudo (suggestions pour éviter les vrais prénoms) et **code personnel**. Autre appareil : classe plus code.
- Accueil : blocs assignés avec échéance, « Mes mots difficiles » (Leitner personnel libre), accès libre aux modes. Parcours guidé ou libre selon l'assignation.
- Séance : 5 à 10 minutes par défaut. Bilan simple (mots gagnés, mots à revoir), sans comparaison.
- Visuel : style B (tuiles pop, fond clair) ; arcade en style A (sombre) ; pas de mascotte ni de langage enfantin.

## 8. Espace enseignant et remédiateur

- **Classes** : création, lien et QR, liste des pseudos, récupération d'un code perdu. La correspondance pseudo et vrai nom reste dans le carnet de l'enseignant, jamais dans l'app.
- **Assignation** : bloc liste, chapitre, regroupement ou remédiation. Réglages, chacun avec aide contextuelle sous le champ (label précis, placeholder concret, effet de la saisie) : parcours guidé ou libre, sens, modes autorisés, arcade (vitesse, désactivation de C), révision ou test blanc, échéance, nouvelles cartes par séance, phrases d'aide.
- **Tableau de bord**, interrupteur Action / Vue d'ensemble :
  - Action : propositions de remédiation, mots difficiles (bonne réponse, texte tapé, type d'erreur, audio), élèves à relancer.
  - Vue d'ensemble : matrice élèves par listes (chiffre et couleur), dernier passage, objectif de classe.
  - Fiche élève : boîtes par sens, erreurs types, régularité. Fiche mot : taux d'échec par sens, erreurs fréquentes.
- **Remédiation** : un mot est proposé quand au moins 3 élèves, ou 30 % de ceux qui l'ont travaillé, le ratent sur les 2 dernières semaines (seuil réglable). Proposition pré-remplie (mots, élèves, sens), modifiable, validée par un humain, puis assignée. Aucune assignation automatique.
- **Test blanc** : résultat marqué « entraînement non certificatif », distinct des séances d'entraînement. Aucune cote ni bulletin dans l'app.

## 9. Rôles et accès

- **Enseignant** : propriétaire de ses classes, crée et assigne.
- **Remédiateur** : invité par l'enseignant sur une classe ou un élève. Voit les résultats, valide et lance les remédiations, ne modifie pas le contenu.
- **Bibliothèque partagée** : classeurs publiés aux écoles coopérantes, utilisables par copie.
- RLS sur toutes les tables, avec fonctions `security definer` pour toute vérification de rôle qui lit la même table (pas de politique auto-référentielle, voir l'incident AménagActif du 2026-09-23).

## 10. Vie privée (RGPD)

- Pseudos seulement : pas d'e-mail ni de nom côté élève.
- Journal détaillé conservé 90 jours (à confirmer), puis agrégé.
- Suppression d'un élève ou d'une classe en un clic.
- Cadre exact avec les écoles (information aux familles, hébergement, base légale) : **à confirmer avec elles, non traité dans ce spec**.

## 11. Audio

- Générée une fois à l'import avec le service de Dialogue Audio (edge-tts, voix belges et britanniques), mise en cache, servie à tous.
- Remplacement par mot (nouvelle génération ou enregistrement de l'enseignant).
- Audio absent ou service indisponible : texte affiché, message « audio indisponible », **pas de repli silencieux** sur une voix du navigateur (risque de néerlandais des Pays-Bas). Liste des mots sans audio visible par l'enseignant.
- Réserve : edge-tts est un accès non officiel à un service Microsoft. Moteur interchangeable, cache indispensable.

## 12. Hors ligne et synchronisation

- Réponses mises en file locale avec identifiant unique, envoyées au retour du réseau, sans doublon. Message clair quand des réponses attendent.
- Recalcul de l'état Leitner à la synchronisation (voir 5.6).

## 13. Erreurs et sécurité

- Import Excel invalide : rien n'est importé tant que le rapport n'est pas corrigé.
- Clés (Supabase service role, clés TTS, IA) côté serveur uniquement. Aucun `console.log` avec données élèves.
- Fonctions `/api/*` limitées en débit.
- Aucun nom d'élève stocké.

## 14. Tests

Écrits avant le code des parties critiques :

- Correction (juste, presque, faux, accents, synonymes) et classement des types d'erreur.
- Leitner : promotions, retours, plafonds par mode, « juste avec aide », test blanc sans effet.
- Rejeu du journal : même état quel que soit l'ordre d'arrivée, deux appareils, doublons.
- Validateur d'import Excel sur des classeurs défectueux.
- Parcours complets en navigateur, sur GSM réel, contrôle d'accessibilité (contraste, taille, navigation clavier, réduction des effets).
- Données du tableau de bord (seuils de remédiation, agrégation après 90 jours).

## 15. Ordre de construction

1. **Fondations** : dépôt, base, comptes, branding PLAI (navigation, conteneur, pied de page, vérifié visuellement), import Excel, génération audio.
2. **Moteur et premier test terrain** : correction, Leitner, journal, synchronisation, accès élève, QCM audio et taper, tableau de bord minimal. Essai avec une vraie classe avant la suite.
3. **Autres modes et blocs** : flashcards, association, roue de lettres, blocs chapitre, regroupement, test blanc, phrase exemple.
4. **Arcade A et C**, objectif de classe, remédiation proposée, bibliothèque partagée.
5. **v1.1** : phrases à trou (réutilisent les phrases exemples) et dialogue audio avec questions en langue cible et/ou en français, via Dialogue Audio, avec relecture enseignant.

Chaque étape suivra le cycle spec, plan, implémentation, avec revue finale globale après la dernière tâche. L'arcade C est le premier mode à décaler si le calendrier se tend.

## 16. Ancrage RISS

Vérifié dans le corpus RISS le 2026-10-01 (accès HTTP direct au serveur local, le client MCP de la session ayant échoué). Les extraits lus sont cités ; ce qui n'a pas été lu n'est pas affirmé.

| Référence | Ce qu'elle apporte à cette conception |
|---|---|
| `tel-02461323`, Latimier (2019), thèse « Optimisation de l'apprentissage par récupération en mémoire pour promouvoir la rétention à long terme » | Méta-analyses : apprentissage avec tests espacés meilleur que tests massés (g = 0,74) ; avantage non significatif sur relectures espacées (g = 0,46) ; pas de différence entre planning expansif et uniforme (g = 0,032). Justifie l'espacement et le rappel, et **relativise le choix précis des intervalles Leitner** |
| `hal-05484395`, Sigayret, Parmentier et Silvestre (2026), Frontiers in Psychology, « Testing the testing effect on prolific: when retrieval practice fails to boost learning » | Titre vérifié, contenu non analysé en détail. À lire avant publication : signale que l'effet n'est pas universel, dans un contexte en ligne |
| `tel-03216648`, Choffin (2021), thèse « Algorithmes d'espacement adaptatif de l'apprentissage… » | Présente le système de Leitner et Anki, et la nécessité de bien choisir l'intervalle d'espacement. Piste pour une version adaptative ultérieure |
| `dumas-03351379`, Benoit (2021), mémoire « Mémorisation du lexique en classe de FLE : l'utilisation du logiciel Anki » | Cite Lieury (2005) : sur 16 mots, reconnaissance 71 %, rappel différé 28 %. Appui secondaire (mémoire de master, résultat de seconde main) pour le **plafond des modes de reconnaissance** |
| `tel-00728785`, Chaves (2012) ; `hal-00825972`, Chaves, Bosse et Largy (2010) | Titres vérifiés. Rôle du traitement visuel dans l'orthographe lexicale : appui à la roue de lettres. Passage exact à relire |
| `tel-00979303`, Pérez (2013), « L'apprentissage de l'orthographe lors de la dictée et la copie de mots manuscrits » | Titre vérifié. **Correction** : le spec LexiActif attribue cette cote à « Pacton, Fayol & Perruchet, cités » ; l'auteur de la thèse est Pérez |
| `hal-05494071`, Belaid (2026) ; `hal-04682680`, Plessis-Ouzariah (2024) | Titres vérifiés (jeux sérieux, ludification adaptative). Utilisés dans LexiActif pour la gamification. Contenu à relire avant citation ici |
| `ensl-01576226`, Rey et Feyfant (2014), « Évaluer pour (mieux) faire apprendre » | Titre vérifié. Appui possible à une rétroaction orientée progrès plutôt que classement. Passage à relire |

**Hypothèses sans appui vérifié à ce jour (ne pas présenter comme établies)** :

- l'effet de la phrase en contexte sur l'acquisition du vocabulaire en langue étrangère, et le risque de charge de lecture pour des élèves faibles ou DYS ;
- le plafond précis de boîte par mode (3, 4, 5) : proposition de conception, à documenter ;
- le seuil de remédiation (3 élèves ou 30 %) : choix de départ, à calibrer sur le terrain ;
- l'effet de la rétroaction « presque » avec saisie de la bonne forme.

Références internationales réelles mais hors corpus RISS (non utilisées dans l'app tant que non marquées « réel, hors corpus RISS ») : à ne pas ajouter de mémoire.

## 17. Hors périmètre de la v1

Enregistrement vocal de l'élève, classement, duels asynchrones entre classes, mémory, remise en ordre de phrases, notes officielles, grammaire, difficulté adaptative automatique, administration au niveau de l'école.

## 18. Ce que l'app ne fait pas bien (à écrire dans l'app et le guide enseignant)

- Ne travaille ni la prononciation ni l'expression orale de l'élève.
- Ne certifie rien : le test blanc est un entraînement.
- Ne remplace pas les phrases, les situations et les échanges de la classe.
- Les phrases et les audios générés par IA doivent être relus par l'enseignant.

## 19. Questions challengeantes (réponses de conception)

- *Résultats identiques d'un enseignant à l'autre ?* Non : listes, phrases et synonymes viennent de l'enseignant, réglages d'assignation différents.
- *Mécanisme qui pousse à personnaliser ?* Zone IA modifiable, remédiation validée à la main, copie adaptable de la bibliothèque.
- *Bénéfice pour l'élève en difficulté ?* Mode libre « mes mots difficiles », vitesse et effets réglables en arcade, aucun classement, retour qualifié.
- *Risque de moindre confiance de l'enseignant en son jugement ?* Propositions toujours modifiables, jamais appliquées sans validation.

## 20. Questions ouvertes

1. Durée de conservation du journal détaillé et place restante sur le Supabase partagé.
2. Cadre RGPD avec les écoles (information aux familles, hébergement).
3. Validation des listes partagées : qui corrige les erreurs et les droits sur les contenus de manuels.
4. Stabilité d'edge-tts sur la durée, et plan de repli.
5. Création du dépôt GitHub `jfb4plai/LangActif` par JF avant l'implémentation.
