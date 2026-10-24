/**
 * AQL sampling plans — ISO 2859-1 (equivalent to ANSI/ASQ Z1.4), single sampling,
 * normal inspection, General Inspection Level II.
 *
 * The data below is a direct encoding of the standard's Table 1 (sample size code letters,
 * level II column) and Table 2-A (master table, normal inspection). Arrow cells in Table 2-A
 * are stored as "down"/"up" and resolved the way the standard prescribes: use the first
 * sampling plan below (down) or above (up) the arrow, including that plan's sample size.
 *
 * The inspection level and the AQL values are configuration, not universal rules: brands
 * choose them per order (apparel commonly uses 2.5 for major and 4.0 for minor defects, with
 * zero tolerance for critical defects as a buyer policy rather than a table value).
 */

export const SAMPLING_STANDARD = "ISO 2859-1 · General Inspection Level II · single sampling, normal inspection";

export const SUPPORTED_AQLS = [0.65, 1.0, 1.5, 2.5, 4.0, 6.5] as const;
export type AqlValue = (typeof SUPPORTED_AQLS)[number];

/** Table 1, General Inspection Level II: [max lot size, code letter]. */
const LOT_TO_CODE: [number, CodeLetter][] = [
  [8, "A"], [15, "B"], [25, "C"], [50, "D"], [90, "E"], [150, "F"], [280, "G"], [500, "H"],
  [1200, "J"], [3200, "K"], [10000, "L"], [35000, "M"], [150000, "N"], [500000, "P"], [Infinity, "Q"],
];

type CodeLetter = "A" | "B" | "C" | "D" | "E" | "F" | "G" | "H" | "J" | "K" | "L" | "M" | "N" | "P" | "Q" | "R";
const CODE_LETTERS: CodeLetter[] = ["A", "B", "C", "D", "E", "F", "G", "H", "J", "K", "L", "M", "N", "P", "Q", "R"];
const SAMPLE_SIZE: Record<CodeLetter, number> = {
  A: 2, B: 3, C: 5, D: 8, E: 13, F: 20, G: 32, H: 50, J: 80, K: 125, L: 200, M: 315, N: 500, P: 800, Q: 1250, R: 2000,
};

type Cell = [number, number] | "down" | "up";
const D = "down" as const;
const U = "up" as const;

/** Table 2-A cells for the supported AQL columns, in SUPPORTED_AQLS order. */
const TABLE_2A: Record<CodeLetter, Cell[]> = {
  //      0.65     1.0      1.5      2.5      4.0       6.5
  A: [D,       D,       D,       D,       D,        [0, 1]],
  B: [D,       D,       D,       D,       [0, 1],   U],
  C: [D,       D,       D,       [0, 1],  U,        D],
  D: [D,       D,       [0, 1],  U,       D,        [1, 2]],
  E: [D,       [0, 1],  U,       D,       [1, 2],   [2, 3]],
  F: [[0, 1],  U,       D,       [1, 2],  [2, 3],   [3, 4]],
  G: [U,       D,       [1, 2],  [2, 3],  [3, 4],   [5, 6]],
  H: [D,       [1, 2],  [2, 3],  [3, 4],  [5, 6],   [7, 8]],
  J: [[1, 2],  [2, 3],  [3, 4],  [5, 6],  [7, 8],   [10, 11]],
  K: [[2, 3],  [3, 4],  [5, 6],  [7, 8],  [10, 11], [14, 15]],
  L: [[3, 4],  [5, 6],  [7, 8],  [10, 11],[14, 15], [21, 22]],
  M: [[5, 6],  [7, 8],  [10, 11],[14, 15],[21, 22], U],
  N: [[7, 8],  [10, 11],[14, 15],[21, 22],U,        U],
  P: [[10, 11],[14, 15],[21, 22],U,       U,        U],
  Q: [[14, 15],[21, 22],U,       U,       U,        U],
  R: [[21, 22],U,       U,       U,       U,        U],
};

export type SamplingPlan = {
  codeLetter: string;
  sampleSize: number;
  accept: number;
  reject: number;
  /** True when the sample size reaches the lot size, i.e. every unit is inspected. */
  fullInspection: boolean;
};

export function codeLetterForLot(lotSize: number): CodeLetter {
  if (!Number.isInteger(lotSize) || lotSize < 2) throw new RangeError("Lot size must be a whole number of at least 2.");
  return LOT_TO_CODE.find(([max]) => lotSize <= max)![1];
}

export function samplingPlan(lotSize: number, aql: number): SamplingPlan {
  const col = SUPPORTED_AQLS.indexOf(aql as AqlValue);
  if (col === -1) throw new RangeError(`AQL ${aql} is not configured. Supported values: ${SUPPORTED_AQLS.join(", ")}.`);
  let row = CODE_LETTERS.indexOf(codeLetterForLot(lotSize));
  // Follow arrows until a numeric plan is reached.
  for (let guard = 0; guard < CODE_LETTERS.length; guard++) {
    const cell = TABLE_2A[CODE_LETTERS[row]][col];
    if (cell === "down") row += 1;
    else if (cell === "up") row -= 1;
    else {
      const letter = CODE_LETTERS[row];
      const n = SAMPLE_SIZE[letter];
      return { codeLetter: letter, sampleSize: Math.min(n, lotSize), accept: cell[0], reject: cell[1], fullInspection: n >= lotSize };
    }
  }
  throw new Error("Sampling table is inconsistent.");
}

export type InspectionPlan = {
  standard: string;
  lotSize: number;
  sampleSize: number;
  major: SamplingPlan & { aql: number };
  minor: SamplingPlan & { aql: number };
  criticalAllowed: number;
};

/**
 * Combined plan for one inspection. Major and minor defects can resolve to different
 * sample sizes; the inspector draws the larger one, which is the stricter choice.
 */
export function inspectionPlan(lotSize: number, aqlMajor: number, aqlMinor: number, criticalAllowed = 0): InspectionPlan {
  const major = { ...samplingPlan(lotSize, aqlMajor), aql: aqlMajor };
  const minor = { ...samplingPlan(lotSize, aqlMinor), aql: aqlMinor };
  return {
    standard: SAMPLING_STANDARD,
    lotSize,
    sampleSize: Math.max(major.sampleSize, minor.sampleSize),
    major,
    minor,
    criticalAllowed,
  };
}

export type DefectCounts = { critical: number; major: number; minor: number };

export function evaluateInspection(plan: InspectionPlan, counts: DefectCounts) {
  const reasons: string[] = [];
  if (counts.critical > plan.criticalAllowed) reasons.push(`${counts.critical} critical defect(s) found; ${plan.criticalAllowed} allowed.`);
  if (counts.major > plan.major.accept) reasons.push(`${counts.major} major defect(s) found; accept limit is ${plan.major.accept} at AQL ${plan.major.aql}.`);
  if (counts.minor > plan.minor.accept) reasons.push(`${counts.minor} minor defect(s) found; accept limit is ${plan.minor.accept} at AQL ${plan.minor.aql}.`);
  return { result: reasons.length === 0 ? ("PASS" as const) : ("FAIL" as const), reasons };
}
