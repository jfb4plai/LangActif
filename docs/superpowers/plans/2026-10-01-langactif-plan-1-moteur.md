# LangActif, plan 1 : moteur pur et validateur d'import

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construire et tester toute la logique métier de LangActif qui ne dépend ni de React, ni de Supabase, ni du réseau : correction des réponses, Leitner, rejeu du journal, sélection de séance, propositions de remédiation, moteur de la roue de lettres, lecture et validation d'un classeur Excel de chapitre.

**Architecture:** Bibliothèque TypeScript pure (fonctions sans effet de bord, temps et hasard injectés), testée avec Vitest. Elle sera consommée plus tard par l'interface élève, l'interface enseignant et les fonctions `/api/*`. Le validateur d'import travaille sur une structure neutre (`RawWorkbook`) ; seul `readXlsx.ts` touche `exceljs`.

**Tech Stack:** TypeScript 5, Vitest 2, exceljs 4, Node 20+.

**Spec de référence :** `docs/superpowers/specs/2026-10-01-langactif-design.md` (sections 4.2, 5.2 à 5.6, 6.1, 8).

## Découpage des plans

Le spec couvre plusieurs sous-systèmes. Chaque plan produit un logiciel testable seul.

1. **Plan 1 (ce document)** : moteur pur et validateur d'import.
2. Plan 2 : application React/Vite/Tailwind, branding PLAI, Supabase (tables `lang_*`, RLS, grants), comptes enseignant, import Excel en base, génération audio.
3. Plan 3 : accès élève (pseudo, code personnel, QR/lien), file hors ligne, synchronisation, QCM audio et taper, premier test terrain.
4. Plan 4 : tableau de bord (Action / Vue d'ensemble), remédiation proposée et validée, rôle remédiateur.
5. Plan 5 : autres modes (flashcards, association, roue de lettres), blocs chapitre, regroupement, test blanc, phrase exemple.
6. Plan 6 : arcade A et C, objectif de classe, bibliothèque partagée. Puis v1.1 (phrases à trou, dialogue audio).

## Décisions d'implémentation à valider par JF

Le spec laisse ces points ouverts ; ce plan les tranche ainsi (modifiables, chacun isolé dans une constante ou une fonction) :

1. **Boîte 1 : intervalle de 0 jour.** « Le jour même ou le lendemain » : la carte est immédiatement redue, la sélection de séance évitera les répétitions dans une même séance (plan 3).
2. **Réponse « juste avec aide »** : ne compte pas dans `nbJuste` (compteur `nbAide` séparé), ni montée ni retour.
3. **Réponse juste sans promotion** (plafond du mode atteint) : la carte est replanifiée à l'intervalle de sa boîte actuelle.
4. **Article manquant ou erroné** (néerlandais) : verdict `faux`, type d'erreur `mauvais_article`. Ce n'est pas un `presque` : le spec réserve `presque` à l'orthographe et à l'accent.
5. **Vers la langue cible** : strict = accents et majuscules différents donnent `presque`.
6. **Seuil « faute proche »** : longueur normalisée de 3 caractères ou moins : aucune faute tolérée ; de 4 à 8 : une ; 9 et plus : deux (distance de Damerau-Levenshtein, la transposition compte pour 1).
7. **Seuil de remédiation** : 3 élèves, ou 30 % des élèves qui ont travaillé la carte avec au moins 2 élèves concernés (garde-fou ajouté pour éviter « 1 élève sur 2 »). Un élève est « en échec » si sa dernière réponse dans la fenêtre de 14 jours n'est pas `juste`.
8. **Identifiants de mots** : non attribués par l'importeur (ils le seront à l'insertion en base, plan 2).

## Structure des fichiers

Tout sous `C:\Users\jfbeg\OneDrive\claude-workspace\langactif\`.

| Fichier | Responsabilité |
|---|---|
| `package.json`, `tsconfig.json`, `vitest.config.ts`, `.gitignore` | outillage |
| `src/engine/types.ts` | types partagés (mot, carte, réponse, verdict) et constantes |
| `src/engine/text.ts` | normalisation, accents, distance de Damerau-Levenshtein |
| `src/engine/judge.ts` | verdict et type d'erreur d'une réponse tapée |
| `src/engine/modes.ts` | plafond de boîte par mode |
| `src/engine/leitner.ts` | intervalles, application d'une réponse à l'état d'une carte |
| `src/engine/replay.ts` | recalcul de l'état des cartes depuis le journal |
| `src/engine/session.ts` | expansion des cartes selon le sens, choix des cartes d'une séance |
| `src/engine/remediation.ts` | propositions de remédiation depuis le journal |
| `src/engine/wheel.ts` | roue de lettres : leurres, éligibilité, lettres bien placées |
| `src/importer/chapter.ts` | validation et analyse d'un classeur (structure neutre) |
| `src/importer/readXlsx.ts` | lecture d'un `.xlsx` vers `RawWorkbook` |
| `src/index.ts` | export public |

Chaque fichier de logique a son `*.test.ts` voisin.

---

### Task 0 : Outillage

**Files:**
- Create: `package.json`, `tsconfig.json`, `vitest.config.ts`, `.gitignore`

- [ ] **Step 1: Créer `package.json`**

```json
{
  "name": "langactif",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "description": "LangActif : vocabulaire de langues étrangères, moteur pur",
  "scripts": {
    "test": "vitest run",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "exceljs": "^4.4.0"
  },
  "devDependencies": {
    "@types/node": "^20.14.10",
    "typescript": "^5.5.3",
    "vitest": "^2.1.4"
  }
}
```

- [ ] **Step 2: Créer `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2022"],
    "types": ["node"],
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "isolatedModules": true,
    "skipLibCheck": true,
    "noEmit": true
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Créer `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: { include: ['src/**/*.test.ts'] },
});
```

- [ ] **Step 4: Créer `.gitignore`**

```
node_modules
dist
.env
.env.*
.superpowers/
```

- [ ] **Step 5: Installer et configurer git**

Run (dans `langactif/`):
```bash
npm install
git config user.name "jfb4plai"
git config user.email "jf.beguin@outlook.com"
```
Expected: `added N packages`, aucun message d'erreur.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json tsconfig.json vitest.config.ts .gitignore
git commit -m "chore: outillage TypeScript et Vitest

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 1 : Types partagés

**Files:**
- Create: `src/engine/types.ts`

Pas de test propre (types et constantes) : il est couvert par les tâches suivantes.

- [ ] **Step 1: Créer `src/engine/types.ts`**

```ts
export type Langue = 'en-GB' | 'nl-BE';
export type Direction = 'fr_to_l' | 'l_to_fr';
export type Article = 'de' | 'het';
export type Box = 1 | 2 | 3 | 4 | 5;

export interface Word {
  id: string;
  fr: string;
  cible: string;
  article: Article | null;
  synonymesFr: string[];
  synonymesCible: string[];
}

export type Mode =
  | 'flashcards'
  | 'qcm'
  | 'association'
  | 'taper'
  | 'roue_sans_leurres'
  | 'roue_avec_leurres'
  | 'arcade_tir'
  | 'arcade_defense';

export type Verdict = 'juste' | 'presque' | 'faux' | 'sans_reponse';

export type ErrorType =
  | 'orthographe_proche'
  | 'mauvais_article'
  | 'confusion_liste'
  | 'sans_reponse'
  | 'autre';

/** Une ligne du journal : une réponse d'un élève sur une carte. */
export interface AnswerEvent {
  id: string;
  studentId: string;
  wordId: string;
  direction: Direction;
  mode: Mode;
  verdict: Verdict;
  errorType: ErrorType | null;
  /** « Voir dans une phrase » utilisé : réponse juste avec aide. */
  aide: boolean;
  /** Test blanc : journalisé, sans effet sur les boîtes. */
  test: boolean;
  /** Horodatage en millisecondes (epoch). */
  ts: number;
  answerText?: string;
  latencyMs?: number;
}

export interface CardState {
  key: string;
  wordId: string;
  direction: Direction;
  box: Box;
  dueAt: number;
  nbJuste: number;
  nbPresque: number;
  nbFaux: number;
  nbAide: number;
  lastAt: number;
}

export interface CardRef {
  wordId: string;
  direction: Direction;
}

export const DAY_MS = 86_400_000;

export function cardKey(wordId: string, direction: Direction): string {
  return `${wordId}:${direction}`;
}
```

- [ ] **Step 2: Vérifier que le typage passe**

Run: `npx tsc --noEmit`
Expected: aucune sortie (succès).

- [ ] **Step 3: Commit**

```bash
git add src/engine/types.ts
git commit -m "feat(engine): types partagés

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 2 : Normalisation de texte et distance

**Files:**
- Create: `src/engine/text.ts`
- Test: `src/engine/text.test.ts`

- [ ] **Step 1: Écrire le test qui échoue**

```ts
// src/engine/text.test.ts
import { describe, expect, it } from 'vitest';
import { clean, damerau, foldKey, maxTypos, stripAccents } from './text';

describe('clean', () => {
  it('supprime les espaces en trop', () => {
    expect(clean('  de   fiets ')).toBe('de fiets');
  });
});

describe('stripAccents', () => {
  it('retire les accents', () => {
    expect(stripAccents('vélo')).toBe('velo');
    expect(stripAccents('Ëïç')).toBe('Eic');
  });
});

describe('foldKey', () => {
  it('ignore casse, accents et espaces', () => {
    expect(foldKey('  Vélo ')).toBe('velo');
  });
});

describe('damerau', () => {
  it('compte une transposition pour 1', () => {
    expect(damerau('fiets', 'fiest')).toBe(1);
  });
  it('compte une substitution pour 1', () => {
    expect(damerau('huis', 'huys')).toBe(1);
  });
  it('gère les chaînes vides', () => {
    expect(damerau('abc', '')).toBe(3);
    expect(damerau('', 'abc')).toBe(3);
  });
  it('retrouve la distance classique', () => {
    expect(damerau('kitten', 'sitting')).toBe(3);
  });
  it('vaut 0 pour deux chaînes identiques', () => {
    expect(damerau('straat', 'straat')).toBe(0);
  });
});

describe('maxTypos', () => {
  it('tolère 0, 1 ou 2 fautes selon la longueur', () => {
    expect(maxTypos(3)).toBe(0);
    expect(maxTypos(4)).toBe(1);
    expect(maxTypos(8)).toBe(1);
    expect(maxTypos(9)).toBe(2);
  });
});
```

- [ ] **Step 2: Vérifier l'échec**

Run: `npx vitest run src/engine/text.test.ts`
Expected: FAIL (`Failed to resolve import "./text"`).

- [ ] **Step 3: Implémenter `src/engine/text.ts`**

```ts
/** Espaces normalisés, forme Unicode composée. */
export function clean(s: string): string {
  return s.normalize('NFC').trim().replace(/\s+/g, ' ');
}

export function stripAccents(s: string): string {
  return s.normalize('NFD').replace(/\p{M}/gu, '').normalize('NFC');
}

/** Clé de comparaison floue : sans accents, sans casse, espaces normalisés. */
export function foldKey(s: string): string {
  return stripAccents(clean(s)).toLowerCase();
}

/** Distance de Damerau-Levenshtein (variante « optimal string alignment »). */
export function damerau(a: string, b: string): number {
  const n = a.length;
  const m = b.length;
  const d: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = 0; i <= n; i++) d[i][0] = i;
  for (let j = 0; j <= m; j++) d[0][j] = j;
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
      }
    }
  }
  return d[n][m];
}

/** Nombre de fautes tolérées pour un verdict « presque », selon la longueur. */
export function maxTypos(len: number): number {
  if (len <= 3) return 0;
  if (len <= 8) return 1;
  return 2;
}
```

- [ ] **Step 4: Vérifier le succès**

Run: `npx vitest run src/engine/text.test.ts`
Expected: PASS (9 tests).

- [ ] **Step 5: Commit**

```bash
git add src/engine/text.ts src/engine/text.test.ts
git commit -m "feat(engine): normalisation de texte et distance de Damerau-Levenshtein

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 3 : Verdict et type d'erreur

**Files:**
- Create: `src/engine/judge.ts`
- Test: `src/engine/judge.test.ts`

- [ ] **Step 1: Écrire le test qui échoue**

```ts
// src/engine/judge.test.ts
import { describe, expect, it } from 'vitest';
import { acceptedForms, defaultTolerance, judge, type JudgeInput } from './judge';
import type { Word } from './types';

const fiets: Word = { id: 'w1', fr: 'vélo', cible: 'fiets', article: 'de', synonymesFr: ['bicyclette'], synonymesCible: [] };
const huis: Word = { id: 'w2', fr: 'maison', cible: 'huis', article: 'het', synonymesFr: [], synonymesCible: [] };
const straat: Word = { id: 'w3', fr: 'rue', cible: 'straat', article: 'de', synonymesFr: [], synonymesCible: [] };
const chair: Word = { id: 'e1', fr: 'chaise', cible: 'chair', article: null, synonymesFr: [], synonymesCible: [] };
const list = [fiets, huis, straat];

function j(word: Word, direction: JudgeInput['direction'], answer: string, extra: Partial<JudgeInput> = {}) {
  return judge({ word, direction, answer, listWords: list, ...extra });
}

describe('acceptedForms', () => {
  it('ajoute l\'article en néerlandais vers la langue cible', () => {
    expect(acceptedForms(fiets, 'fr_to_l')).toEqual(['de fiets']);
  });
  it('liste les synonymes français vers le français', () => {
    expect(acceptedForms(fiets, 'l_to_fr')).toEqual(['vélo', 'bicyclette']);
  });
});

describe('defaultTolerance', () => {
  it('est souple vers le français et stricte vers la langue cible', () => {
    expect(defaultTolerance('l_to_fr')).toEqual({ accents: true, casse: true });
    expect(defaultTolerance('fr_to_l')).toEqual({ accents: false, casse: false });
  });
});

describe('judge, français vers langue cible', () => {
  it('juste', () => {
    expect(j(fiets, 'fr_to_l', 'de fiets')).toEqual({ verdict: 'juste', errorType: null, expected: 'de fiets' });
  });
  it('presque quand seule la casse diffère (strict)', () => {
    const r = j(fiets, 'fr_to_l', 'De Fiets');
    expect(r.verdict).toBe('presque');
    expect(r.errorType).toBe('orthographe_proche');
  });
  it('presque pour une transposition de lettres', () => {
    expect(j(fiets, 'fr_to_l', 'de fiest').verdict).toBe('presque');
  });
  it('faux avec mauvais_article quand l\'article manque', () => {
    const r = j(fiets, 'fr_to_l', 'fiets');
    expect(r.verdict).toBe('faux');
    expect(r.errorType).toBe('mauvais_article');
  });
  it('faux avec mauvais_article quand l\'article est inversé', () => {
    expect(j(fiets, 'fr_to_l', 'het fiets').errorType).toBe('mauvais_article');
    expect(j(huis, 'fr_to_l', 'de huis').errorType).toBe('mauvais_article');
  });
  it('faux avec confusion_liste quand on donne un autre mot de la liste', () => {
    const r = j(fiets, 'fr_to_l', 'de straat');
    expect(r.verdict).toBe('faux');
    expect(r.errorType).toBe('confusion_liste');
  });
  it('sans_reponse quand la réponse est vide', () => {
    expect(j(fiets, 'fr_to_l', '').verdict).toBe('sans_reponse');
    expect(j(fiets, 'fr_to_l', '   ').errorType).toBe('sans_reponse');
  });
  it('faux autre pour un mot sans rapport', () => {
    const r = j(fiets, 'fr_to_l', 'banaan');
    expect(r.verdict).toBe('faux');
    expect(r.errorType).toBe('autre');
  });
});

describe('judge, langue cible vers français', () => {
  it('tolère accents et casse par défaut', () => {
    expect(j(fiets, 'l_to_fr', 'velo').verdict).toBe('juste');
    expect(j(fiets, 'l_to_fr', 'VÉLO').verdict).toBe('juste');
  });
  it('accepte un synonyme', () => {
    expect(j(fiets, 'l_to_fr', 'Bicyclette').verdict).toBe('juste');
  });
  it('signale une confusion avec un autre mot de la liste', () => {
    expect(j(fiets, 'l_to_fr', 'maison').errorType).toBe('confusion_liste');
  });
  it('ne tolère aucune faute sur un mot de 3 lettres ou moins', () => {
    const r = j(straat, 'l_to_fr', 'rus');
    expect(r.verdict).toBe('faux');
    expect(r.errorType).toBe('autre');
  });
  it('devient stricte si on le demande', () => {
    expect(j(fiets, 'l_to_fr', 'velo', { tolerance: { accents: false, casse: false } }).verdict).toBe('presque');
  });
});

describe('judge, anglais (sans article)', () => {
  const only = [chair];
  it('juste', () => {
    expect(judge({ word: chair, direction: 'fr_to_l', answer: 'chair', listWords: only }).verdict).toBe('juste');
  });
  it('presque pour une transposition', () => {
    expect(judge({ word: chair, direction: 'fr_to_l', answer: 'chiar', listWords: only }).verdict).toBe('presque');
  });
});
```

- [ ] **Step 2: Vérifier l'échec**

Run: `npx vitest run src/engine/judge.test.ts`
Expected: FAIL (`Failed to resolve import "./judge"`).

- [ ] **Step 3: Implémenter `src/engine/judge.ts`**

```ts
import { clean, damerau, foldKey, maxTypos, stripAccents } from './text';
import type { Direction, ErrorType, Verdict, Word } from './types';

export interface Tolerance {
  /** true : les différences d'accents sont ignorées. */
  accents: boolean;
  /** true : les différences de majuscules sont ignorées. */
  casse: boolean;
}

export function defaultTolerance(direction: Direction): Tolerance {
  return direction === 'l_to_fr' ? { accents: true, casse: true } : { accents: false, casse: false };
}

export interface JudgeInput {
  word: Word;
  direction: Direction;
  answer: string;
  /** Les autres mots de la liste, pour détecter une confusion. */
  listWords: Word[];
  tolerance?: Tolerance;
}

export interface JudgeResult {
  verdict: Verdict;
  errorType: ErrorType | null;
  expected: string;
}

type Level = 'juste' | 'presque' | 'faux';
const RANK: Record<Level, number> = { juste: 0, presque: 1, faux: 2 };
const ARTICLES = ['de', 'het'];

/** Formes acceptées ; la première est celle qu'on affiche comme bonne réponse. */
export function acceptedForms(word: Word, direction: Direction): string[] {
  if (direction === 'l_to_fr') return [word.fr, ...word.synonymesFr];
  const primary = word.article ? `${word.article} ${word.cible}` : word.cible;
  return [primary, ...word.synonymesCible];
}

function tolKey(s: string, tol: Tolerance): string {
  let k = clean(s);
  if (tol.casse) k = k.toLowerCase();
  if (tol.accents) k = stripAccents(k);
  return k;
}

function compare(answer: string, form: string, tol: Tolerance): Level {
  if (tolKey(answer, tol) === tolKey(form, tol)) return 'juste';
  const a = foldKey(answer);
  const f = foldKey(form);
  if (a === f) return 'presque';
  return damerau(a, f) <= maxTypos(f.length) ? 'presque' : 'faux';
}

function hasArticleProblem(answer: string, word: Word, tol: Tolerance): boolean {
  const [first, ...rest] = answer.split(' ');
  if (ARTICLES.includes(first.toLowerCase()) && rest.length > 0) {
    return first.toLowerCase() !== word.article && compare(rest.join(' '), word.cible, tol) !== 'faux';
  }
  // article manquant : le nom est reconnu sans article
  return compare(answer, word.cible, tol) !== 'faux';
}

function matchesOtherWord(answer: string, word: Word, listWords: Word[], direction: Direction, tol: Tolerance): boolean {
  for (const other of listWords) {
    if (other.id === word.id) continue;
    for (const form of acceptedForms(other, direction)) {
      if (compare(answer, form, tol) !== 'faux') return true;
    }
  }
  return false;
}

export function judge(input: JudgeInput): JudgeResult {
  const { word, direction, listWords } = input;
  const tol = input.tolerance ?? defaultTolerance(direction);
  const forms = acceptedForms(word, direction);
  const expected = forms[0];
  const answer = clean(input.answer);

  if (answer === '') return { verdict: 'sans_reponse', errorType: 'sans_reponse', expected };

  let best: Level = 'faux';
  for (const form of forms) {
    const level = compare(answer, form, tol);
    if (RANK[level] < RANK[best]) best = level;
  }
  if (best === 'juste') return { verdict: 'juste', errorType: null, expected };
  if (best === 'presque') return { verdict: 'presque', errorType: 'orthographe_proche', expected };

  if (direction === 'fr_to_l' && word.article && hasArticleProblem(answer, word, tol)) {
    return { verdict: 'faux', errorType: 'mauvais_article', expected };
  }
  if (matchesOtherWord(answer, word, listWords, direction, tol)) {
    return { verdict: 'faux', errorType: 'confusion_liste', expected };
  }
  return { verdict: 'faux', errorType: 'autre', expected };
}
```

- [ ] **Step 4: Vérifier le succès**

Run: `npx vitest run src/engine/judge.test.ts`
Expected: PASS (18 tests). Si un cas échoue, ne pas modifier le test : relire la règle correspondante dans « Décisions d'implémentation » et corriger l'implémentation.

- [ ] **Step 5: Commit**

```bash
git add src/engine/judge.ts src/engine/judge.test.ts
git commit -m "feat(engine): verdict juste/presque/faux et type d'erreur

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 4 : Plafond de boîte par mode

**Files:**
- Create: `src/engine/modes.ts`
- Test: `src/engine/modes.test.ts`

- [ ] **Step 1: Écrire le test qui échoue**

```ts
// src/engine/modes.test.ts
import { describe, expect, it } from 'vitest';
import { MODE_CAP } from './modes';

describe('MODE_CAP', () => {
  it('plafonne la reconnaissance à la boîte 3', () => {
    for (const m of ['flashcards', 'qcm', 'association', 'arcade_tir', 'roue_sans_leurres'] as const) {
      expect(MODE_CAP[m]).toBe(3);
    }
  });
  it('plafonne la roue avec leurres à la boîte 4', () => {
    expect(MODE_CAP.roue_avec_leurres).toBe(4);
  });
  it('laisse la production monter à la boîte 5', () => {
    expect(MODE_CAP.taper).toBe(5);
    expect(MODE_CAP.arcade_defense).toBe(5);
  });
});
```

- [ ] **Step 2: Vérifier l'échec**

Run: `npx vitest run src/engine/modes.test.ts`
Expected: FAIL (`Failed to resolve import "./modes"`).

- [ ] **Step 3: Implémenter `src/engine/modes.ts`**

```ts
import type { Box, Mode } from './types';

/**
 * Boîte maximale atteignable par un mode (spec 5.3).
 * Hypothèse pédagogique : reconnaître est plus facile que produire,
 * donc seule une production réussie fait monter au-delà de la boîte 3.
 */
export const MODE_CAP: Record<Mode, Box> = {
  flashcards: 3,
  qcm: 3,
  association: 3,
  arcade_tir: 3,
  roue_sans_leurres: 3,
  roue_avec_leurres: 4,
  taper: 5,
  arcade_defense: 5,
};
```

- [ ] **Step 4: Vérifier le succès**

Run: `npx vitest run src/engine/modes.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/engine/modes.ts src/engine/modes.test.ts
git commit -m "feat(engine): plafond de boîte par mode

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 5 : Leitner

**Files:**
- Create: `src/engine/leitner.ts`
- Test: `src/engine/leitner.test.ts`

- [ ] **Step 1: Écrire le test qui échoue**

```ts
// src/engine/leitner.test.ts
import { describe, expect, it } from 'vitest';
import { applyAnswer, INTERVAL_DAYS, isMastered } from './leitner';
import { DAY_MS, type AnswerEvent, type CardState } from './types';

const T0 = 1_000_000_000_000;

function ev(over: Partial<AnswerEvent> = {}): AnswerEvent {
  return {
    id: 'e',
    studentId: 's1',
    wordId: 'w1',
    direction: 'fr_to_l',
    mode: 'taper',
    verdict: 'juste',
    errorType: null,
    aide: false,
    test: false,
    ts: T0,
    ...over,
  };
}

function state(box: CardState['box'], over: Partial<CardState> = {}): CardState {
  return {
    key: 'w1:fr_to_l',
    wordId: 'w1',
    direction: 'fr_to_l',
    box,
    dueAt: T0,
    nbJuste: 0,
    nbPresque: 0,
    nbFaux: 0,
    nbAide: 0,
    lastAt: T0,
    ...over,
  };
}

describe('INTERVAL_DAYS', () => {
  it('suit le calendrier du spec', () => {
    expect(INTERVAL_DAYS).toEqual({ 1: 0, 2: 2, 3: 4, 4: 7, 5: 14 });
  });
});

describe('applyAnswer', () => {
  it('crée une carte et la fait monter en boîte 2 sur une première bonne réponse', () => {
    const s = applyAnswer(undefined, ev({ mode: 'qcm' }))!;
    expect(s.box).toBe(2);
    expect(s.dueAt).toBe(T0 + 2 * DAY_MS);
    expect(s.nbJuste).toBe(1);
    expect(s.key).toBe('w1:fr_to_l');
  });

  it('crée une carte en boîte 1 sur une première erreur', () => {
    const s = applyAnswer(undefined, ev({ verdict: 'faux' }))!;
    expect(s.box).toBe(1);
    expect(s.dueAt).toBe(T0);
    expect(s.nbFaux).toBe(1);
  });

  it('respecte le plafond de la reconnaissance', () => {
    const s = applyAnswer(state(3), ev({ mode: 'qcm' }))!;
    expect(s.box).toBe(3);
    expect(s.dueAt).toBe(T0 + 4 * DAY_MS);
  });

  it('fait monter par une production', () => {
    expect(applyAnswer(state(3), ev({ mode: 'taper' }))!.box).toBe(4);
    expect(applyAnswer(state(4), ev({ mode: 'taper' }))!.box).toBe(5);
    expect(applyAnswer(state(5), ev({ mode: 'taper' }))!.box).toBe(5);
  });

  it('plafonne la roue avec leurres à la boîte 4', () => {
    expect(applyAnswer(state(4), ev({ mode: 'roue_avec_leurres' }))!.box).toBe(4);
    expect(applyAnswer(state(3), ev({ mode: 'roue_avec_leurres' }))!.box).toBe(4);
  });

  it('ne fait jamais descendre une carte sur une bonne réponse', () => {
    expect(applyAnswer(state(5), ev({ mode: 'qcm' }))!.box).toBe(5);
  });

  it('renvoie en boîte 1 sur une erreur', () => {
    const s = applyAnswer(state(5), ev({ verdict: 'faux' }))!;
    expect(s.box).toBe(1);
    expect(s.dueAt).toBe(T0);
  });

  it('traite « sans réponse » comme une erreur', () => {
    expect(applyAnswer(state(4), ev({ verdict: 'sans_reponse' }))!.box).toBe(1);
  });

  it('laisse la boîte inchangée sur un « presque » et redemande tout de suite', () => {
    const s = applyAnswer(state(3, { dueAt: T0 - DAY_MS }), ev({ verdict: 'presque' }))!;
    expect(s.box).toBe(3);
    expect(s.dueAt).toBe(T0);
    expect(s.nbPresque).toBe(1);
  });

  it('ne change ni la boîte ni l\'échéance sur une réponse juste avec aide', () => {
    const before = state(3, { dueAt: T0 - 5 });
    const s = applyAnswer(before, ev({ aide: true }))!;
    expect(s.box).toBe(3);
    expect(s.dueAt).toBe(T0 - 5);
    expect(s.nbJuste).toBe(0);
    expect(s.nbAide).toBe(1);
  });

  it('ignore les réponses de test blanc', () => {
    const before = state(3);
    expect(applyAnswer(before, ev({ test: true, verdict: 'faux' }))).toBe(before);
    expect(applyAnswer(undefined, ev({ test: true }))).toBeUndefined();
  });

  it('ne modifie pas l\'état reçu', () => {
    const before = state(2);
    applyAnswer(before, ev({ mode: 'taper' }));
    expect(before.box).toBe(2);
  });
});

describe('isMastered', () => {
  it('est vrai à partir de la boîte 4', () => {
    expect(isMastered(state(3))).toBe(false);
    expect(isMastered(state(4))).toBe(true);
    expect(isMastered(state(5))).toBe(true);
    expect(isMastered(undefined)).toBe(false);
  });
});
```

- [ ] **Step 2: Vérifier l'échec**

Run: `npx vitest run src/engine/leitner.test.ts`
Expected: FAIL (`Failed to resolve import "./leitner"`).

- [ ] **Step 3: Implémenter `src/engine/leitner.ts`**

```ts
import { MODE_CAP } from './modes';
import { DAY_MS, cardKey, type AnswerEvent, type Box, type CardState } from './types';

/** Intervalle avant revoir, par boîte. Boîte 1 : 0 jour (redue tout de suite). */
export const INTERVAL_DAYS: Record<Box, number> = { 1: 0, 2: 2, 3: 4, 4: 7, 5: 14 };

/** Un mot est « maîtrisé » à partir de cette boîte. */
export const MASTERED_FROM: Box = 4;

export function isMastered(state: CardState | undefined): boolean {
  return state !== undefined && state.box >= MASTERED_FROM;
}

/**
 * Applique une réponse à l'état d'une carte. Pure : ne modifie pas `prev`.
 * Une réponse de test blanc n'a aucun effet.
 */
export function applyAnswer(prev: CardState | undefined, ev: AnswerEvent): CardState | undefined {
  if (ev.test) return prev;

  const s: CardState = prev
    ? { ...prev }
    : {
        key: cardKey(ev.wordId, ev.direction),
        wordId: ev.wordId,
        direction: ev.direction,
        box: 1,
        dueAt: ev.ts,
        nbJuste: 0,
        nbPresque: 0,
        nbFaux: 0,
        nbAide: 0,
        lastAt: ev.ts,
      };
  s.lastAt = ev.ts;

  switch (ev.verdict) {
    case 'juste':
      if (ev.aide) {
        s.nbAide += 1;
      } else {
        s.nbJuste += 1;
        const cap = MODE_CAP[ev.mode];
        s.box = Math.max(s.box, Math.min(s.box + 1, cap)) as Box;
        s.dueAt = ev.ts + INTERVAL_DAYS[s.box] * DAY_MS;
      }
      break;
    case 'presque':
      s.nbPresque += 1;
      s.dueAt = ev.ts;
      break;
    case 'faux':
    case 'sans_reponse':
      s.nbFaux += 1;
      s.box = 1;
      s.dueAt = ev.ts;
      break;
  }
  return s;
}
```

- [ ] **Step 4: Vérifier le succès**

Run: `npx vitest run src/engine/leitner.test.ts`
Expected: PASS (14 tests).

- [ ] **Step 5: Commit**

```bash
git add src/engine/leitner.ts src/engine/leitner.test.ts
git commit -m "feat(engine): Leitner à 5 boîtes avec plafond par mode

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 6 : Rejeu du journal

**Files:**
- Create: `src/engine/replay.ts`
- Test: `src/engine/replay.test.ts`

- [ ] **Step 1: Écrire le test qui échoue**

```ts
// src/engine/replay.test.ts
import { describe, expect, it } from 'vitest';
import { replayEvents } from './replay';
import type { AnswerEvent } from './types';

const T0 = 1_000_000_000_000;

function ev(over: Partial<AnswerEvent>): AnswerEvent {
  return {
    id: 'e',
    studentId: 's1',
    wordId: 'w1',
    direction: 'fr_to_l',
    mode: 'taper',
    verdict: 'juste',
    errorType: null,
    aide: false,
    test: false,
    ts: T0,
    ...over,
  };
}

const serialize = (m: ReturnType<typeof replayEvents>) =>
  JSON.stringify([...m.entries()].sort(([a], [b]) => (a < b ? -1 : 1)));

const journal: AnswerEvent[] = [
  ev({ id: 'a', mode: 'qcm', ts: T0 + 1000 }),
  ev({ id: 'b', mode: 'taper', ts: T0 + 2000 }),
  ev({ id: 'c', mode: 'taper', ts: T0 + 3000 }),
  ev({ id: 'd', wordId: 'w2', verdict: 'faux', ts: T0 + 2500 }),
];

describe('replayEvents', () => {
  it('reconstruit l\'état de chaque carte', () => {
    const cards = replayEvents(journal);
    expect(cards.get('w1:fr_to_l')!.box).toBe(4); // qcm: 2, taper: 3, taper: 4
    expect(cards.get('w2:fr_to_l')!.box).toBe(1);
  });

  it('donne le même état quel que soit l\'ordre d\'arrivée', () => {
    const shuffled = [journal[2], journal[3], journal[0], journal[1]];
    expect(serialize(replayEvents(shuffled))).toBe(serialize(replayEvents(journal)));
  });

  it('ignore les doublons d\'identifiant', () => {
    const doubled = [...journal, journal[1], journal[2]];
    expect(serialize(replayEvents(doubled))).toBe(serialize(replayEvents(journal)));
  });

  it('départage deux appareils par l\'horodatage', () => {
    const cards = replayEvents([
      ev({ id: 'phone', verdict: 'faux', ts: T0 + 5000 }),
      ev({ id: 'pc', mode: 'taper', ts: T0 + 1000 }),
    ]);
    expect(cards.get('w1:fr_to_l')!.box).toBe(1);
  });

  it('suit séparément chaque sens', () => {
    const cards = replayEvents([
      ev({ id: 'x', direction: 'fr_to_l' }),
      ev({ id: 'y', direction: 'l_to_fr', verdict: 'faux' }),
    ]);
    expect(cards.get('w1:fr_to_l')!.box).toBe(2);
    expect(cards.get('w1:l_to_fr')!.box).toBe(1);
  });

  it('ignore le test blanc', () => {
    const cards = replayEvents([ev({ id: 't', test: true })]);
    expect(cards.size).toBe(0);
  });
});
```

- [ ] **Step 2: Vérifier l'échec**

Run: `npx vitest run src/engine/replay.test.ts`
Expected: FAIL (`Failed to resolve import "./replay"`).

- [ ] **Step 3: Implémenter `src/engine/replay.ts`**

```ts
import { applyAnswer } from './leitner';
import { cardKey, type AnswerEvent, type CardState } from './types';

/**
 * Recalcule l'état des cartes d'UN élève depuis son journal.
 * Doublons ignorés (par `id`), ordre d'arrivée sans effet (tri par `ts`, puis `id`).
 */
export function replayEvents(events: AnswerEvent[]): Map<string, CardState> {
  const seen = new Set<string>();
  const unique = events.filter((e) => {
    if (seen.has(e.id)) return false;
    seen.add(e.id);
    return true;
  });
  unique.sort((a, b) => a.ts - b.ts || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

  const cards = new Map<string, CardState>();
  for (const ev of unique) {
    const key = cardKey(ev.wordId, ev.direction);
    const next = applyAnswer(cards.get(key), ev);
    if (next) cards.set(key, next);
  }
  return cards;
}
```

- [ ] **Step 4: Vérifier le succès**

Run: `npx vitest run src/engine/replay.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/engine/replay.ts src/engine/replay.test.ts
git commit -m "feat(engine): rejeu du journal, sans doublon et indépendant de l'ordre

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 7 : Choix des cartes d'une séance

**Files:**
- Create: `src/engine/session.ts`
- Test: `src/engine/session.test.ts`

- [ ] **Step 1: Écrire le test qui échoue**

```ts
// src/engine/session.test.ts
import { describe, expect, it } from 'vitest';
import { expandCards, pickSessionCards } from './session';
import { DAY_MS, type CardRef, type CardState } from './types';

const NOW = 1_000_000_000_000;

function st(wordId: string, box: CardState['box'], dueAt: number): CardState {
  return {
    key: `${wordId}:fr_to_l`,
    wordId,
    direction: 'fr_to_l',
    box,
    dueAt,
    nbJuste: 0,
    nbPresque: 0,
    nbFaux: 0,
    nbAide: 0,
    lastAt: NOW,
  };
}

const ref = (wordId: string): CardRef => ({ wordId, direction: 'fr_to_l' });

describe('expandCards', () => {
  const words = [{ id: 'w1' }, { id: 'w2' }];
  it('un seul sens', () => {
    expect(expandCards(words, 'fr_to_l')).toEqual([
      { wordId: 'w1', direction: 'fr_to_l' },
      { wordId: 'w2', direction: 'fr_to_l' },
    ]);
  });
  it('les deux sens (mixte)', () => {
    expect(expandCards(words, 'both')).toHaveLength(4);
    expect(expandCards(words, 'both')[1]).toEqual({ wordId: 'w1', direction: 'l_to_fr' });
  });
});

describe('pickSessionCards', () => {
  it('met les cartes dues d\'abord (boîte basse en premier) puis quelques nouvelles', () => {
    const states = new Map<string, CardState>([
      ['w1:fr_to_l', st('w1', 3, NOW - DAY_MS)],
      ['w2:fr_to_l', st('w2', 2, NOW - 2 * DAY_MS)],
      ['w3:fr_to_l', st('w3', 2, NOW + DAY_MS)], // pas encore due
    ]);
    const picked = pickSessionCards({
      cards: [ref('w1'), ref('w2'), ref('w3'), ref('w4'), ref('w5')],
      states,
      now: NOW,
      maxNew: 1,
    });
    expect(picked.map((c) => c.wordId)).toEqual(['w2', 'w1', 'w4']);
  });

  it('limite le total', () => {
    const picked = pickSessionCards({
      cards: [ref('a'), ref('b'), ref('c'), ref('d')],
      states: new Map(),
      now: NOW,
      maxNew: 10,
      maxTotal: 2,
    });
    expect(picked).toHaveLength(2);
  });

  it('ne propose pas une carte maîtrisée non due', () => {
    const states = new Map<string, CardState>([['w1:fr_to_l', st('w1', 5, NOW + 10 * DAY_MS)]]);
    expect(pickSessionCards({ cards: [ref('w1')], states, now: NOW, maxNew: 5 })).toEqual([]);
  });
});
```

- [ ] **Step 2: Vérifier l'échec**

Run: `npx vitest run src/engine/session.test.ts`
Expected: FAIL (`Failed to resolve import "./session"`).

- [ ] **Step 3: Implémenter `src/engine/session.ts`**

```ts
import { cardKey, type CardRef, type CardState, type Direction } from './types';

/** Transforme des mots en cartes selon le sens de l'assignation. */
export function expandCards(words: Array<{ id: string }>, sens: Direction | 'both'): CardRef[] {
  const refs: CardRef[] = [];
  for (const w of words) {
    if (sens === 'fr_to_l' || sens === 'both') refs.push({ wordId: w.id, direction: 'fr_to_l' });
    if (sens === 'l_to_fr' || sens === 'both') refs.push({ wordId: w.id, direction: 'l_to_fr' });
  }
  return refs;
}

export interface PickOptions {
  cards: CardRef[];
  states: Map<string, CardState>;
  now: number;
  /** Nombre maximal de cartes jamais vues introduites dans la séance. */
  maxNew: number;
  maxTotal?: number;
}

/**
 * Cartes dues d'abord (boîte la plus basse, puis la plus ancienne),
 * puis jusqu'à `maxNew` cartes nouvelles dans l'ordre de la liste.
 */
export function pickSessionCards(o: PickOptions): CardRef[] {
  const due: Array<{ ref: CardRef; dueAt: number; box: number }> = [];
  const fresh: CardRef[] = [];
  for (const ref of o.cards) {
    const state = o.states.get(cardKey(ref.wordId, ref.direction));
    if (!state) fresh.push(ref);
    else if (state.dueAt <= o.now) due.push({ ref, dueAt: state.dueAt, box: state.box });
  }
  due.sort((a, b) => a.box - b.box || a.dueAt - b.dueAt);
  const picked = [...due.map((d) => d.ref), ...fresh.slice(0, o.maxNew)];
  return o.maxTotal === undefined ? picked : picked.slice(0, o.maxTotal);
}
```

- [ ] **Step 4: Vérifier le succès**

Run: `npx vitest run src/engine/session.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/engine/session.ts src/engine/session.test.ts
git commit -m "feat(engine): choix des cartes d'une séance et expansion selon le sens

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 8 : Propositions de remédiation

**Files:**
- Create: `src/engine/remediation.ts`
- Test: `src/engine/remediation.test.ts`

- [ ] **Step 1: Écrire le test qui échoue**

```ts
// src/engine/remediation.test.ts
import { describe, expect, it } from 'vitest';
import { proposeRemediation } from './remediation';
import { DAY_MS, type AnswerEvent } from './types';

const NOW = 100 * DAY_MS;
let n = 0;

function ev(studentId: string, over: Partial<AnswerEvent> = {}): AnswerEvent {
  n += 1;
  return {
    id: `e${n}`,
    studentId,
    wordId: 'w1',
    direction: 'fr_to_l',
    mode: 'taper',
    verdict: 'faux',
    errorType: 'orthographe_proche',
    aide: false,
    test: false,
    ts: NOW - DAY_MS,
    ...over,
  };
}

const ok = (studentId: string, over: Partial<AnswerEvent> = {}) =>
  ev(studentId, { verdict: 'juste', errorType: null, ...over });

describe('proposeRemediation', () => {
  it('propose une carte ratée par 3 élèves', () => {
    const out = proposeRemediation([ev('a'), ev('b'), ev('c')], { now: NOW });
    expect(out).toHaveLength(1);
    expect(out[0].key).toBe('w1:fr_to_l');
    expect(out[0].missStudents.sort()).toEqual(['a', 'b', 'c']);
    expect(out[0].topError).toBe('orthographe_proche');
  });

  it('ne propose pas 2 échecs sur 10 élèves (20 %)', () => {
    const events = [ev('s1'), ev('s2'), ...['s3', 's4', 's5', 's6', 's7', 's8', 's9', 's10'].map((s) => ok(s))];
    expect(proposeRemediation(events, { now: NOW })).toEqual([]);
  });

  it('propose 2 échecs sur 5 élèves (40 %)', () => {
    const events = [ev('s1'), ev('s2'), ok('s3'), ok('s4'), ok('s5')];
    expect(proposeRemediation(events, { now: NOW })).toHaveLength(1);
  });

  it('ne propose pas 1 échec sur 2 élèves (garde-fou)', () => {
    expect(proposeRemediation([ev('s1'), ok('s2')], { now: NOW })).toEqual([]);
  });

  it('compte la dernière réponse de l\'élève : un élève qui a réussi ensuite n\'est plus en échec', () => {
    // 10 élèves ont travaillé la carte ; c a échoué puis réussi.
    // Si l'échec ancien de c comptait, il y aurait 3 élèves en échec et une proposition.
    const events = [
      ev('a'),
      ev('b'),
      ev('c', { ts: NOW - 3 * DAY_MS }),
      ok('c', { ts: NOW - DAY_MS }),
      ...['s1', 's2', 's3', 's4', 's5', 's6', 's7'].map((s) => ok(s)),
    ];
    expect(proposeRemediation(events, { now: NOW })).toEqual([]);
  });

  it('ignore ce qui est hors de la fenêtre de 14 jours', () => {
    const old = NOW - 20 * DAY_MS;
    expect(proposeRemediation([ev('a', { ts: old }), ev('b', { ts: old }), ev('c', { ts: old })], { now: NOW })).toEqual([]);
  });

  it('prend en compte le test blanc', () => {
    const events = [ev('a', { test: true }), ev('b', { test: true }), ev('c', { test: true })];
    expect(proposeRemediation(events, { now: NOW })).toHaveLength(1);
  });

  it('sépare les deux sens et trie par nombre d\'élèves en échec', () => {
    const events = [
      ev('a'), ev('b'), ev('c'),
      ev('a', { wordId: 'w2', direction: 'l_to_fr' }),
      ev('b', { wordId: 'w2', direction: 'l_to_fr' }),
      ev('c', { wordId: 'w2', direction: 'l_to_fr' }),
      ev('d', { wordId: 'w2', direction: 'l_to_fr' }),
    ];
    const out = proposeRemediation(events, { now: NOW });
    expect(out.map((p) => p.key)).toEqual(['w2:l_to_fr', 'w1:fr_to_l']);
  });
});
```

- [ ] **Step 2: Vérifier l'échec**

Run: `npx vitest run src/engine/remediation.test.ts`
Expected: FAIL (`Failed to resolve import "./remediation"`).

- [ ] **Step 3: Implémenter `src/engine/remediation.ts`**

```ts
import { DAY_MS, cardKey, type AnswerEvent, type Direction, type ErrorType } from './types';

export interface RemediationOptions {
  now: number;
  windowDays?: number;
  /** Nombre d'élèves en échec qui déclenche une proposition. */
  minStudents?: number;
  /** Part des élèves ayant travaillé la carte qui déclenche une proposition. */
  minShare?: number;
  /** Garde-fou pour la voie « part » : au moins ce nombre d'élèves en échec. */
  minStudentsForShare?: number;
}

export interface RemediationProposal {
  key: string;
  wordId: string;
  direction: Direction;
  missStudents: string[];
  workedCount: number;
  share: number;
  topError: ErrorType | null;
}

/**
 * Cartes à proposer pour une remédiation (le test blanc compte).
 * Un élève est « en échec » si sa dernière réponse dans la fenêtre n'est pas `juste`.
 * Le résultat est une PROPOSITION : un humain la valide ou la modifie.
 */
export function proposeRemediation(events: AnswerEvent[], o: RemediationOptions): RemediationProposal[] {
  const windowDays = o.windowDays ?? 14;
  const minStudents = o.minStudents ?? 3;
  const minShare = o.minShare ?? 0.3;
  const minStudentsForShare = o.minStudentsForShare ?? 2;
  const since = o.now - windowDays * DAY_MS;

  const latest = new Map<string, Map<string, AnswerEvent>>();
  const errors = new Map<string, Map<ErrorType, number>>();

  for (const ev of events) {
    if (ev.ts < since || ev.ts > o.now) continue;
    const key = cardKey(ev.wordId, ev.direction);

    let perStudent = latest.get(key);
    if (!perStudent) {
      perStudent = new Map();
      latest.set(key, perStudent);
    }
    const current = perStudent.get(ev.studentId);
    if (!current || ev.ts >= current.ts) perStudent.set(ev.studentId, ev);

    if (ev.errorType) {
      let counts = errors.get(key);
      if (!counts) {
        counts = new Map();
        errors.set(key, counts);
      }
      counts.set(ev.errorType, (counts.get(ev.errorType) ?? 0) + 1);
    }
  }

  const proposals: RemediationProposal[] = [];
  for (const [key, perStudent] of latest) {
    const workedCount = perStudent.size;
    const missStudents = [...perStudent.entries()].filter(([, e]) => e.verdict !== 'juste').map(([id]) => id);
    const share = workedCount === 0 ? 0 : missStudents.length / workedCount;
    const triggered =
      missStudents.length >= minStudents || (missStudents.length >= minStudentsForShare && share >= minShare);
    if (!triggered) continue;

    let topError: ErrorType | null = null;
    let topCount = 0;
    for (const [type, count] of errors.get(key) ?? []) {
      if (count > topCount) {
        topError = type;
        topCount = count;
      }
    }
    const sample = [...perStudent.values()][0];
    proposals.push({ key, wordId: sample.wordId, direction: sample.direction, missStudents, workedCount, share, topError });
  }

  proposals.sort((a, b) => b.missStudents.length - a.missStudents.length || b.share - a.share);
  return proposals;
}
```

- [ ] **Step 4: Vérifier le succès**

Run: `npx vitest run src/engine/remediation.test.ts`
Expected: PASS (8 tests).

- [ ] **Step 5: Commit**

```bash
git add src/engine/remediation.ts src/engine/remediation.test.ts
git commit -m "feat(engine): propositions de remédiation depuis le journal

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 9 : Roue de lettres

**Files:**
- Create: `src/engine/wheel.ts`
- Test: `src/engine/wheel.test.ts`

- [ ] **Step 1: Écrire le test qui échoue**

```ts
// src/engine/wheel.test.ts
import { describe, expect, it } from 'vitest';
import { buildWheel, countWellPlaced, createSeededRng, isWheelEligible } from './wheel';

const sorted = (a: string[]) => [...a].sort().join('');

describe('createSeededRng', () => {
  it('est déterministe', () => {
    const a = createSeededRng(42);
    const b = createSeededRng(42);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });
});

describe('buildWheel', () => {
  it('contient exactement les lettres du mot sans leurres', () => {
    const w = buildWheel('fiets', 0, 'nl-BE', createSeededRng(1));
    expect(sorted(w)).toBe(sorted(['F', 'I', 'E', 'T', 'S']));
  });

  it('ajoute des leurres absents du mot', () => {
    const w = buildWheel('fiets', 2, 'nl-BE', createSeededRng(1));
    expect(w).toHaveLength(7);
    const letters = new Set('FIETS'.split(''));
    expect(w.filter((l) => !letters.has(l))).toHaveLength(2);
  });

  it('propose des lettres accentuées françaises parmi les leurres', () => {
    const leurres = new Set<string>();
    for (let seed = 0; seed < 200; seed++) {
      for (const l of buildWheel('vélo', 3, 'fr', createSeededRng(seed))) {
        if (!'VÉLO'.includes(l)) leurres.add(l);
      }
    }
    expect([...leurres].some((l) => 'ÈÊÀÂÔÛÙÇÎÏË'.includes(l))).toBe(true);
  });

  it('met le mot en majuscules', () => {
    expect(sorted(buildWheel('vélo', 0, 'fr', createSeededRng(3)))).toBe(sorted(['V', 'É', 'L', 'O']));
  });
});

describe('isWheelEligible', () => {
  it('accepte un mot simple', () => {
    expect(isWheelEligible('fiets')).toEqual({ ok: true });
  });
  it('refuse une expression', () => {
    expect(isWheelEligible('to look for')).toEqual({ ok: false, reason: 'expression' });
    expect(isWheelEligible('rendez-vous')).toEqual({ ok: false, reason: 'expression' });
  });
  it('refuse un mot trop long', () => {
    expect(isWheelEligible('verantwoordelijkheid')).toEqual({ ok: false, reason: 'trop_long' });
  });
  it('refuse un mot vide ou avec des chiffres', () => {
    expect(isWheelEligible('  ')).toEqual({ ok: false, reason: 'vide' });
    expect(isWheelEligible('b2b')).toEqual({ ok: false, reason: 'caracteres' });
  });
});

describe('countWellPlaced', () => {
  it('compte les lettres à la bonne place sans dire lesquelles', () => {
    expect(countWellPlaced('chiar', 'chair')).toBe(3);
    expect(countWellPlaced('CHAIR', 'chair')).toBe(5);
  });
  it('gère des longueurs différentes', () => {
    expect(countWellPlaced('ch', 'chair')).toBe(2);
  });
});
```

- [ ] **Step 2: Vérifier l'échec**

Run: `npx vitest run src/engine/wheel.test.ts`
Expected: FAIL (`Failed to resolve import "./wheel"`).

- [ ] **Step 3: Implémenter `src/engine/wheel.ts`**

```ts
import type { Langue } from './types';

/** Générateur pseudo-aléatoire graine (mulberry32), pour des tests déterministes. */
export function createSeededRng(seed: number): () => number {
  let state = seed >>> 0;
  return function next() {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const AZ = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const POOLS: Record<Langue | 'fr', string[]> = {
  'en-GB': AZ.split(''),
  'nl-BE': (AZ + 'ËÏ').split(''),
  fr: (AZ + 'ÉÈÊËÀÂÔÛÙÇÎÏ').split(''),
};

function shuffle<T>(items: T[], rng: () => number): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Lettres mélangées de la roue : celles du mot, plus `leurres` lettres absentes du mot. */
export function buildWheel(word: string, leurres: number, langue: Langue | 'fr', rng: () => number = Math.random): string[] {
  const letters = word.toUpperCase().split('');
  if (leurres > 0) {
    const inWord = new Set(letters);
    const available = POOLS[langue].filter((l) => !inWord.has(l));
    for (let i = 0; i < leurres && available.length > 0; i++) {
      const idx = Math.floor(rng() * available.length);
      letters.push(available[idx]);
      available.splice(idx, 1);
    }
  }
  return shuffle(letters, rng);
}

export type WheelEligibility = { ok: true } | { ok: false; reason: 'vide' | 'expression' | 'trop_long' | 'caracteres' };

export const WHEEL_MAX_LETTERS = 10;

/** Seuls les mots simples d'au plus 10 lettres vont dans la roue. */
export function isWheelEligible(word: string): WheelEligibility {
  const w = word.trim();
  if (w === '') return { ok: false, reason: 'vide' };
  if (/[\s-]/.test(w)) return { ok: false, reason: 'expression' };
  if (!/^\p{L}+$/u.test(w)) return { ok: false, reason: 'caracteres' };
  if (w.length > WHEEL_MAX_LETTERS) return { ok: false, reason: 'trop_long' };
  return { ok: true };
}

/** Retour qualifié : nombre de lettres à la bonne place, sans dire lesquelles. */
export function countWellPlaced(attempt: string, target: string): number {
  const a = attempt.toUpperCase();
  const t = target.toUpperCase();
  let count = 0;
  for (let i = 0; i < Math.min(a.length, t.length); i++) if (a[i] === t[i]) count++;
  return count;
}
```

- [ ] **Step 4: Vérifier le succès**

Run: `npx vitest run src/engine/wheel.test.ts`
Expected: PASS (11 tests).

- [ ] **Step 5: Commit**

```bash
git add src/engine/wheel.ts src/engine/wheel.test.ts
git commit -m "feat(engine): roue de lettres, leurres, éligibilité, lettres bien placées

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 10 : Validation d'un classeur de chapitre

**Files:**
- Create: `src/importer/chapter.ts`
- Test: `src/importer/chapter.test.ts`

- [ ] **Step 1: Écrire le test qui échoue**

```ts
// src/importer/chapter.test.ts
import { describe, expect, it } from 'vitest';
import { parseChapter, type RawSheet, type RawWorkbook } from './chapter';

function sheet(name: string, header: string[], rows: string[][]): RawSheet {
  return { name, header, rows: rows.map((cells, i) => ({ n: i + 2, cells })) };
}

function book(over: Partial<RawWorkbook> = {}): RawWorkbook {
  return {
    hasMeta: true,
    meta: { langue: 'nl-BE', niveau: 'A1', titre: 'Le vélo et la ville', numero: '4' },
    lists: [
      sheet('Liste 4.1', ['fr', 'cible', 'article', 'synonymes_fr', 'phrase_cible', 'phrase_fr'], [
        ['vélo', 'fiets', 'de', 'bicyclette', 'Ik ga met de fiets naar school.', 'Je vais à l\'école à vélo.'],
        ['maison', 'huis', 'het', '', '', ''],
      ]),
    ],
    ...over,
  };
}

describe('parseChapter, cas valide', () => {
  it('analyse un chapitre néerlandais', () => {
    const r = parseChapter(book());
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.chapter.langue).toBe('nl-BE');
    expect(r.chapter.numero).toBe('4');
    const [fiets, huis] = r.chapter.lists[0].words;
    expect(fiets).toEqual({
      fr: 'vélo',
      cible: 'fiets',
      article: 'de',
      synonymesFr: ['bicyclette'],
      synonymesCible: [],
      phraseCible: 'Ik ga met de fiets naar school.',
      phraseFr: 'Je vais à l\'école à vélo.',
      audioUrl: null,
    });
    expect(huis.phraseCible).toBeNull();
  });

  it('accepte « - » comme absence d\'article et sépare les synonymes par « ; »', () => {
    const r = parseChapter(book({
      lists: [sheet('L', ['fr', 'cible', 'article', 'synonymes_cible'], [['courir', 'lopen', '-', 'rennen; hardlopen']])],
    }));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.chapter.lists[0].words[0].article).toBeNull();
    expect(r.chapter.lists[0].words[0].synonymesCible).toEqual(['rennen', 'hardlopen']);
  });

  it('accepte l\'anglais sans colonne article', () => {
    const r = parseChapter(book({
      meta: { langue: 'en-GB', niveau: 'A1', titre: 'Town', numero: '1' },
      lists: [sheet('L', ['fr', 'cible'], [['chaise', 'chair']])],
    }));
    expect(r.ok).toBe(true);
  });

  it('ignore les lignes entièrement vides', () => {
    const r = parseChapter(book({
      lists: [sheet('L', ['fr', 'cible', 'article'], [['vélo', 'fiets', 'de'], ['', '', ''], ['maison', 'huis', 'het']])],
    }));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.chapter.lists[0].words).toHaveLength(2);
  });
});

describe('parseChapter, erreurs', () => {
  const issuesOf = (b: RawWorkbook) => {
    const r = parseChapter(b);
    if (r.ok) throw new Error('succès inattendu');
    return r.issues;
  };

  it('signale l\'absence de la feuille Méta', () => {
    const issues = issuesOf(book({ hasMeta: false, meta: {} }));
    expect(issues).toHaveLength(1);
    expect(issues[0].message).toContain('Méta');
  });

  it('signale les champs Méta manquants et une langue inconnue', () => {
    const issues = issuesOf(book({ meta: { langue: 'de-DE', niveau: '', titre: 'X', numero: '1' } }));
    expect(issues.map((i) => i.column)).toEqual(expect.arrayContaining(['langue', 'niveau']));
    expect(issues.find((i) => i.column === 'langue')!.message).toContain('de-DE');
  });

  it('signale une feuille sans liste', () => {
    expect(issuesOf(book({ lists: [] }))[0].message).toContain('Aucune');
  });

  it('signale un article absent ou invalide en néerlandais, avec le numéro de ligne', () => {
    const issues = issuesOf(book({
      lists: [sheet('L', ['fr', 'cible', 'article'], [['vélo', 'fiets', 'de'], ['maison', 'huis', ''], ['rue', 'straat', 'la']])],
    }));
    expect(issues.map((i) => [i.row, i.column])).toEqual([[3, 'article'], [4, 'article']]);
  });

  it('signale la colonne article manquante en néerlandais', () => {
    const issues = issuesOf(book({ lists: [sheet('L', ['fr', 'cible'], [['vélo', 'fiets']])] }));
    expect(issues[0].column).toBe('article');
  });

  it('refuse un article en anglais', () => {
    const issues = issuesOf(book({
      meta: { langue: 'en-GB', niveau: 'A1', titre: 'Town', numero: '1' },
      lists: [sheet('L', ['fr', 'cible', 'article'], [['chaise', 'chair', 'de']])],
    }));
    expect(issues[0].message).toContain('anglais');
  });

  it('signale fr ou cible manquant', () => {
    const issues = issuesOf(book({
      lists: [sheet('L', ['fr', 'cible', 'article'], [['', 'fiets', 'de'], ['maison', '', 'het']])],
    }));
    expect(issues.map((i) => [i.row, i.column])).toEqual([[2, 'fr'], [3, 'cible']]);
  });

  it('signale les doublons dans une liste', () => {
    const issues = issuesOf(book({
      lists: [sheet('L', ['fr', 'cible', 'article'], [['vélo', 'fiets', 'de'], ['Vélo', 'rijwiel', 'het']])],
    }));
    expect(issues).toHaveLength(1);
    expect(issues[0].message).toContain('Doublon');
    expect(issues[0].row).toBe(3);
  });

  it('exige la phrase et sa traduction ensemble', () => {
    const issues = issuesOf(book({
      lists: [sheet('L', ['fr', 'cible', 'article', 'phrase_cible', 'phrase_fr'], [['vélo', 'fiets', 'de', 'Ik fiets.', '']])],
    }));
    expect(issues[0].column).toBe('phrase_fr');
  });

  it('signale une liste vide', () => {
    expect(issuesOf(book({ lists: [sheet('Vide', ['fr', 'cible', 'article'], [])] }))[0].message).toContain('vide');
  });

  it('signale les colonnes obligatoires absentes', () => {
    const issues = issuesOf(book({ lists: [sheet('L', ['mot'], [['x']])] }));
    expect(issues.map((i) => i.column)).toEqual(expect.arrayContaining(['fr', 'cible']));
  });
});
```

- [ ] **Step 2: Vérifier l'échec**

Run: `npx vitest run src/importer/chapter.test.ts`
Expected: FAIL (`Failed to resolve import "./chapter"`).

- [ ] **Step 3: Implémenter `src/importer/chapter.ts`**

```ts
import type { Article, Langue, Word } from '../engine/types';

export interface RawRow {
  /** Numéro de ligne dans Excel (1 = en-tête). */
  n: number;
  cells: string[];
}
export interface RawSheet {
  name: string;
  /** En-têtes en minuscules. */
  header: string[];
  rows: RawRow[];
}
export interface RawWorkbook {
  hasMeta: boolean;
  /** Clés en minuscules. */
  meta: Record<string, string>;
  lists: RawSheet[];
}

export interface ImportIssue {
  sheet: string;
  row: number | null;
  column: string | null;
  message: string;
}

export type ParsedWord = Omit<Word, 'id'> & {
  phraseCible: string | null;
  phraseFr: string | null;
  audioUrl: string | null;
};
export interface ParsedList {
  name: string;
  words: ParsedWord[];
}
export interface ParsedChapter {
  langue: Langue;
  niveau: string;
  titre: string;
  numero: string;
  auteur: string | null;
  lists: ParsedList[];
}
export type ParseResult = { ok: true; chapter: ParsedChapter } | { ok: false; issues: ImportIssue[] };

const LANGUES: Langue[] = ['en-GB', 'nl-BE'];
const split = (s: string): string[] => s.split(';').map((x) => x.trim()).filter(Boolean);

/** Valide un classeur lu et produit un chapitre ; si une seule erreur, rien n'est importé. */
export function parseChapter(wb: RawWorkbook): ParseResult {
  const issues: ImportIssue[] = [];

  if (!wb.hasMeta) {
    return { ok: false, issues: [{ sheet: 'Méta', row: null, column: null, message: 'Feuille « Méta » absente' }] };
  }

  const need = (key: string): string => {
    const v = (wb.meta[key] ?? '').trim();
    if (!v) issues.push({ sheet: 'Méta', row: null, column: key, message: `Champ « ${key} » manquant` });
    return v;
  };
  const langue = need('langue');
  const niveau = need('niveau');
  const titre = need('titre');
  const numero = need('numero');
  const auteur = (wb.meta['auteur'] ?? '').trim() || null;
  const langueOk = (LANGUES as string[]).includes(langue);
  if (langue && !langueOk) {
    issues.push({ sheet: 'Méta', row: null, column: 'langue', message: `Langue « ${langue} » inconnue (attendu : en-GB ou nl-BE)` });
  }

  if (wb.lists.length === 0) {
    issues.push({ sheet: 'Méta', row: null, column: null, message: 'Aucune feuille de liste dans le classeur' });
  }

  const lists: ParsedList[] = [];
  for (const sheet of wb.lists) {
    const col = (name: string) => sheet.header.indexOf(name);
    const iFr = col('fr');
    const iCible = col('cible');
    const iArticle = col('article');
    if (iFr < 0) issues.push({ sheet: sheet.name, row: 1, column: 'fr', message: 'Colonne « fr » absente' });
    if (iCible < 0) issues.push({ sheet: sheet.name, row: 1, column: 'cible', message: 'Colonne « cible » absente' });
    if (langue === 'nl-BE' && iArticle < 0) {
      issues.push({ sheet: sheet.name, row: 1, column: 'article', message: 'Colonne « article » absente (obligatoire en néerlandais)' });
    }
    if (iFr < 0 || iCible < 0) continue;

    const cell = (row: RawRow, name: string): string => {
      const i = col(name);
      return i < 0 ? '' : (row.cells[i] ?? '').trim();
    };

    const words: ParsedWord[] = [];
    const seenFr = new Set<string>();
    const seenCible = new Set<string>();
    const before = issues.length;

    for (const row of sheet.rows) {
      if (row.cells.every((c) => c.trim() === '')) continue;
      const fr = cell(row, 'fr');
      const cible = cell(row, 'cible');
      const bad = (column: string, message: string) => issues.push({ sheet: sheet.name, row: row.n, column, message });

      if (!fr) bad('fr', 'Mot français manquant');
      if (!cible) bad('cible', 'Mot en langue cible manquant');
      if (!fr || !cible) continue;

      const rawArticle = cell(row, 'article').toLowerCase();
      let article: Article | null = null;
      if (langue === 'nl-BE') {
        if (rawArticle === 'de' || rawArticle === 'het') article = rawArticle;
        else if (rawArticle !== '-') bad('article', 'Article absent ou invalide (de, het, ou « - » si le mot n\'a pas d\'article)');
      } else if (langue === 'en-GB' && rawArticle !== '' && rawArticle !== '-') {
        bad('article', 'Pas d\'article attendu en anglais');
      }

      const kFr = fr.toLowerCase();
      const kCible = cible.toLowerCase();
      if (seenFr.has(kFr) || seenCible.has(kCible)) bad('fr', `Doublon dans la liste : « ${fr} » / « ${cible} »`);
      seenFr.add(kFr);
      seenCible.add(kCible);

      const phraseCible = cell(row, 'phrase_cible') || null;
      const phraseFr = cell(row, 'phrase_fr') || null;
      if (phraseCible && !phraseFr) bad('phrase_fr', 'Traduction française de la phrase manquante');
      if (phraseFr && !phraseCible) bad('phrase_cible', 'Phrase en langue cible manquante');

      words.push({
        fr,
        cible,
        article,
        synonymesFr: split(cell(row, 'synonymes_fr')),
        synonymesCible: split(cell(row, 'synonymes_cible')),
        phraseCible,
        phraseFr,
        audioUrl: cell(row, 'audio_url') || null,
      });
    }

    if (words.length === 0 && issues.length === before) {
      issues.push({ sheet: sheet.name, row: null, column: null, message: 'Liste vide' });
    }
    lists.push({ name: sheet.name, words });
  }

  if (issues.length > 0) return { ok: false, issues };
  return { ok: true, chapter: { langue: langue as Langue, niveau, titre, numero, auteur, lists } };
}
```

- [ ] **Step 4: Vérifier le succès**

Run: `npx vitest run src/importer/chapter.test.ts`
Expected: PASS (15 tests).

Point d'attention pour les erreurs de ligne : dans le test « article absent ou invalide », la ligne `['maison','huis','']` est la ligne Excel 3 et `['rue','straat','la']` la ligne 4 (la ligne 1 est l'en-tête, `sheet()` numérote à partir de 2). Ne pas décaler les numéros.

- [ ] **Step 5: Commit**

```bash
git add src/importer/chapter.ts src/importer/chapter.test.ts
git commit -m "feat(importer): validation et analyse d'un classeur de chapitre

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 11 : Lecture d'un fichier .xlsx

**Files:**
- Create: `src/importer/readXlsx.ts`
- Test: `src/importer/readXlsx.test.ts`

- [ ] **Step 1: Écrire le test qui échoue**

```ts
// src/importer/readXlsx.test.ts
import ExcelJS from 'exceljs';
import { describe, expect, it } from 'vitest';
import { parseChapter } from './chapter';
import { readWorkbook } from './readXlsx';

async function buildFile(withMeta = true): Promise<ArrayBuffer> {
  const wb = new ExcelJS.Workbook();
  if (withMeta) {
    const meta = wb.addWorksheet('Méta');
    meta.addRow(['langue', 'nl-BE']);
    meta.addRow(['niveau', 'A1']);
    meta.addRow(['titre', 'Le vélo et la ville']);
    meta.addRow(['numero', 4]);
    meta.addRow(['auteur', 'JF']);
  }
  const l1 = wb.addWorksheet('Liste 4.1');
  l1.addRow(['fr', 'cible', 'article', 'synonymes_fr']);
  l1.addRow(['vélo', 'fiets', 'de', 'bicyclette']);
  l1.addRow([]);
  l1.addRow(['maison', 'huis', 'het']);
  const l2 = wb.addWorksheet('Liste 4.2');
  l2.addRow(['FR', 'Cible', 'Article']);
  l2.addRow(['rue', 'straat', 'de']);
  return (await wb.xlsx.writeBuffer()) as unknown as ArrayBuffer;
}

describe('readWorkbook', () => {
  it('lit la feuille Méta et les listes avec les numéros de ligne Excel', async () => {
    const raw = await readWorkbook(await buildFile());
    expect(raw.hasMeta).toBe(true);
    expect(raw.meta).toMatchObject({ langue: 'nl-BE', niveau: 'A1', numero: '4', auteur: 'JF' });
    expect(raw.lists.map((l) => l.name)).toEqual(['Liste 4.1', 'Liste 4.2']);
    expect(raw.lists[0].header.slice(0, 3)).toEqual(['fr', 'cible', 'article']);
    expect(raw.lists[0].rows.map((r) => r.n)).toEqual([2, 4]);
    expect(raw.lists[0].rows[0].cells.slice(0, 4)).toEqual(['vélo', 'fiets', 'de', 'bicyclette']);
  });

  it('met les en-têtes en minuscules', async () => {
    const raw = await readWorkbook(await buildFile());
    expect(raw.lists[1].header.slice(0, 3)).toEqual(['fr', 'cible', 'article']);
  });

  it('signale l\'absence de feuille Méta', async () => {
    const raw = await readWorkbook(await buildFile(false));
    expect(raw.hasMeta).toBe(false);
  });

  it('produit un chapitre valide de bout en bout', async () => {
    const r = parseChapter(await readWorkbook(await buildFile()));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.chapter.lists).toHaveLength(2);
    expect(r.chapter.lists[0].words.map((w) => w.cible)).toEqual(['fiets', 'huis']);
  });
});
```

- [ ] **Step 2: Vérifier l'échec**

Run: `npx vitest run src/importer/readXlsx.test.ts`
Expected: FAIL (`Failed to resolve import "./readXlsx"`).

- [ ] **Step 3: Implémenter `src/importer/readXlsx.ts`**

```ts
import ExcelJS from 'exceljs';
import type { RawRow, RawSheet, RawWorkbook } from './chapter';

/** Valeur de cellule en texte : nombres, texte riche, formules et liens inclus. */
function text(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'object') {
    const o = value as unknown as Record<string, unknown>;
    if (Array.isArray(o.richText)) return (o.richText as Array<{ text: string }>).map((r) => r.text).join('');
    if (o.text !== undefined) return String(o.text);
    if (o.result !== undefined) return String(o.result);
    return '';
  }
  return String(value);
}

/** Lit un .xlsx vers une structure neutre ; la validation est faite par `parseChapter`. */
export async function readWorkbook(data: ArrayBuffer): Promise<RawWorkbook> {
  const wb = new ExcelJS.Workbook();
  // les types d'exceljs déclarent un `Buffer` maison ; au runtime Buffer et ArrayBuffer fonctionnent
  await wb.xlsx.load(data as unknown as Parameters<typeof wb.xlsx.load>[0]);

  const meta: Record<string, string> = {};
  const metaSheet = wb.getWorksheet('Méta');
  metaSheet?.eachRow((row) => {
    const key = text(row.getCell(1).value).trim().toLowerCase();
    if (key) meta[key] = text(row.getCell(2).value).trim();
  });

  const lists: RawSheet[] = [];
  wb.eachSheet((ws) => {
    if (ws.name === 'Méta') return;
    let header: string[] = [];
    const rows: RawRow[] = [];
    ws.eachRow({ includeEmpty: false }, (row, n) => {
      const cells: string[] = [];
      for (let c = 1; c <= ws.columnCount; c++) cells.push(text(row.getCell(c).value).trim());
      if (n === 1) header = cells.map((h) => h.toLowerCase());
      else rows.push({ n, cells });
    });
    lists.push({ name: ws.name, header, rows });
  });

  return { hasMeta: metaSheet !== undefined, meta, lists };
}
```

- [ ] **Step 4: Vérifier le succès**

Run: `npx vitest run src/importer/readXlsx.test.ts`
Expected: PASS (4 tests).

Si le test « numéros de ligne » échoue parce qu'`exceljs` ne signale pas la ligne vide, vérifier que `eachRow({ includeEmpty: false })` saute bien la ligne 3 : les lignes de données attendues sont 2 et 4. Ne pas modifier le test sans avoir inspecté `raw.lists[0].rows` avec un `console.log` temporaire (à retirer ensuite).

- [ ] **Step 5: Commit**

```bash
git add src/importer/readXlsx.ts src/importer/readXlsx.test.ts
git commit -m "feat(importer): lecture d'un classeur .xlsx vers la structure neutre

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 12 : Export public, vérification globale et clôture

**Files:**
- Create: `src/index.ts`
- Modify: `C:\Users\jfbeg\OneDrive\claude-workspace\memory\langactif-session-prompt.md`

- [ ] **Step 1: Créer `src/index.ts`**

```ts
export * from './engine/types';
export * from './engine/text';
export * from './engine/judge';
export * from './engine/modes';
export * from './engine/leitner';
export * from './engine/replay';
export * from './engine/session';
export * from './engine/remediation';
export * from './engine/wheel';
export * from './importer/chapter';
export * from './importer/readXlsx';
```

- [ ] **Step 2: Typage et tests complets**

Run: `npx tsc --noEmit && npx vitest run`
Expected: aucune erreur de typage ; `Test Files  10 passed (10)` et tous les tests passent (environ 93).

Si `tsc` signale un conflit de noms entre deux fichiers exportés par `index.ts`, renommer l'export le plus spécifique (ne pas supprimer de fonction).

- [ ] **Step 3: Mettre à jour le fil conducteur de session**

Dans `memory/langactif-session-prompt.md`, remplacer la ligne « **Reste à faire** » par :

```
**Avancement** : plan 1 (moteur pur et validateur d'import) écrit dans `langactif/docs/superpowers/plans/2026-10-01-langactif-plan-1-moteur.md` ; état : voir `git log` du dépôt `langactif`. Plans suivants (React/Supabase, accès élève, tableau de bord, autres modes, arcade) à rédiger un par un après réalisation du précédent. Dépôt GitHub `jfb4plai/LangActif` à créer par JF avant le plan 2.
```

Copier le même texte dans `C:\Users\jfbeg\.claude\projects\C--Users-jfbeg-OneDrive-claude-workspace\memory\langactif-session-prompt.md`.

- [ ] **Step 4: Commit**

```bash
git add src/index.ts
git commit -m "feat: export public du moteur et de l'importeur

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

## Auto-revue du plan contre le spec

**Couverture**
- 4.2 (classeur, Méta, colonnes, validation ligne par ligne, rien d'importé si erreur) : Tasks 10 et 11. Le modèle téléchargeable et l'aide sous chaque colonne relèvent de l'interface (plan 2).
- 5.2 (Leitner, boîtes, maîtrise, lots de nouvelles cartes, « juste avec aide ») : Tasks 5 et 7.
- 5.3 (plafonds par mode) : Task 4.
- 5.4 (trois verdicts, tolérance, synonymes) : Task 3.
- 5.5 (types d'erreur) : Task 3.
- 5.6 (journal, rejeu, test blanc, doublons, deux appareils) : Tasks 5 et 6. La conservation à 90 jours et l'agrégation sont des opérations de base de données (plan 2).
- 6.1 (roue : leurres, accents français, éligibilité, lettres bien placées) : Task 9. L'article demandé à part est une règle d'interface (plan 5).
- 8 (seuil de remédiation) : Task 8.
- Hors de ce plan, volontairement : comptes, RLS, audio, PWA et file hors ligne, interfaces, tableau de bord, arcade, bibliothèque partagée, points et objectif de classe (plans 2 à 6).

**Cohérence des types** : `Word`, `AnswerEvent`, `CardState`, `CardRef`, `Mode`, `Verdict`, `ErrorType`, `Box` sont définis en Task 1 et réutilisés tels quels. `cardKey(wordId, direction)` produit `"w1:fr_to_l"`, forme attendue dans les tests des Tasks 5 à 8. `ParsedWord` omet `id` (décision 8).

**Placeholders** : aucun.
