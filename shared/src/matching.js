/**
 * Deterministic, rule-based factory matching ("rules-v1").
 *
 * Step 1 — mandatory eligibility filters. A factory is excluded (with a reason) when it is
 *          not verified/active, does not make the category, has an MOQ above the order,
 *          lacks a required verified certification, cannot meet the deadline with its lead
 *          time, or has too little free capacity before the deadline.
 * Step 2 — weighted scoring of eligible factories (weights are configurable and sum to 100).
 *
 * The engine is a pure function over plain data, so it can later be replaced by a call to a
 * separate (e.g. Python) matching service that receives the same input and returns the same
 * MatchOutcome shape, without changes to the rest of the application.
 */

export const MATCHING_ALGORITHM = "rules-v1";

/**
 * @typedef {object} MatchWeights
 * @property {number} capability
 * @property {number} fabric
 * @property {number} capacity
 * @property {number} leadTime
 * @property {number} location
 * @property {number} performance
 */

/** @type {MatchWeights} */
export const DEFAULT_WEIGHTS = { capability: 25, fabric: 20, capacity: 15, leadTime: 15, location: 10, performance: 15 };

/**
 * @typedef {object} MatchProject
 * @property {string} category
 * @property {number} quantity
 * @property {number | null} [maxMoq] Highest factory MOQ the brand accepts; defaults to the order quantity.
 * @property {Date | null} deadline
 * @property {string[]} fabrics
 * @property {string[]} requiredCapabilities
 * @property {string[]} requiredCertifications
 * @property {string | null} preferredCountry
 */

/**
 * @typedef {object} MatchCandidate
 * @property {string} manufacturerId
 * @property {string} name
 * @property {boolean} verified
 * @property {boolean} active
 * @property {string} country
 * @property {string[]} categories
 * @property {number} minOrderQuantity
 * @property {number} maxMonthlyCapacity
 * @property {number} committedMonthlyUnits Units per month already committed to active orders.
 * @property {number} typicalLeadTimeDays
 * @property {string[]} capabilities
 * @property {string[]} fabrics
 * @property {string[]} verifiedCertifications
 * @property {{ qcReports: number; qcPassed: number; deliveredOrders: number; onTimeDeliveries: number }} history
 */

/** @typedef {Record<keyof MatchWeights, { score: number; weight: number; note: string }>} ScoreBreakdown */

/**
 * @typedef {object} MatchOutcome
 * @property {{ manufacturerId: string; name: string; score: number; breakdown: ScoreBreakdown; reasons: string[] }[]} eligible
 * @property {{ manufacturerId: string; name: string; reasons: string[] }[]} excluded
 */

const DAY = 24 * 60 * 60 * 1000;
/** @param {string} s */
const norm = (s) => s.trim().toLowerCase();
/** @param {number} n */
const clamp01 = (n) => Math.max(0, Math.min(1, n));
/** @param {number} n */
const round2 = (n) => Math.round(n * 100) / 100;

/** @param {string[]} required @param {string[]} offered */
function overlap(required, offered) {
  const have = new Set(offered.map(norm));
  const matched = required.filter((r) => have.has(norm(r)));
  return { matched, missing: required.filter((r) => !have.has(norm(r))) };
}

/** @param {MatchWeights} w */
export function validateWeights(w) {
  const values = Object.values(w);
  if (values.some((v) => v < 0)) throw new RangeError("Weights cannot be negative.");
  if (values.reduce((a, b) => a + b, 0) !== 100) throw new RangeError("Weights must add up to 100.");
}

/**
 * @param {MatchProject} project @param {MatchCandidate[]} candidates @param {MatchWeights} [weights] @param {Date} [now]
 * @returns {MatchOutcome}
 */
export function matchFactories(project, candidates, weights = DEFAULT_WEIGHTS, now = new Date()) {
  validateWeights(weights);
  const daysAvailable = project.deadline ? Math.floor((project.deadline.getTime() - now.getTime()) / DAY) : null;
  /** @type {MatchOutcome} */
  const outcome = { eligible: [], excluded: [] };

  for (const c of candidates) {
    /** @type {string[]} */
    const excluded = [];
    if (!c.verified) excluded.push("Factory is not verified.");
    if (!c.active) excluded.push("Factory account is suspended.");
    if (!c.categories.includes(project.category)) excluded.push("Does not produce this product category.");
    const moqLimit = Math.min(project.maxMoq ?? project.quantity, project.quantity);
    if (c.minOrderQuantity > moqLimit) {
      excluded.push(`Minimum order is ${c.minOrderQuantity} units; ${moqLimit === project.quantity ? `project needs ${project.quantity}` : `the brand accepts an MOQ of at most ${moqLimit}`}.`);
    }
    const certs = overlap(project.requiredCertifications, c.verifiedCertifications);
    if (certs.missing.length) excluded.push(`Missing verified certification: ${certs.missing.join(", ")}.`);
    if (daysAvailable !== null && c.typicalLeadTimeDays > daysAvailable) {
      excluded.push(`Typical lead time is ${c.typicalLeadTimeDays} days; only ${Math.max(daysAvailable, 0)} days remain before the deadline.`);
    }
    const freeMonthly = Math.max(0, c.maxMonthlyCapacity - c.committedMonthlyUnits);
    const months = daysAvailable === null ? 1 : Math.max(1, daysAvailable / 30);
    const windowCapacity = freeMonthly * months;
    if (windowCapacity < project.quantity) excluded.push(`Free capacity before the deadline (about ${Math.floor(windowCapacity)} units) is below ${project.quantity} units.`);

    if (excluded.length) {
      outcome.excluded.push({ manufacturerId: c.manufacturerId, name: c.name, reasons: excluded });
      continue;
    }

    const caps = overlap(project.requiredCapabilities, c.capabilities);
    const fabrics = overlap(project.fabrics, c.fabrics);
    const capabilityScore = project.requiredCapabilities.length ? caps.matched.length / project.requiredCapabilities.length : 1;
    const fabricScore = project.fabrics.length ? fabrics.matched.length / project.fabrics.length : 1;
    // Full marks at twice the needed capacity.
    const capacityScore = clamp01(windowCapacity / project.quantity / 2);
    // Full marks when at least 30% of the available time is spare after the lead time.
    const slack = daysAvailable === null ? 1 : (daysAvailable - c.typicalLeadTimeDays) / Math.max(daysAvailable, 1);
    const leadScore = clamp01(slack / 0.3);
    const locationScore = !project.preferredCountry || norm(project.preferredCountry) === norm(c.country) ? 1 : 0;
    const h = c.history;
    const hasHistory = h.qcReports > 0 || h.deliveredOrders > 0;
    const qcRate = h.qcReports ? h.qcPassed / h.qcReports : null;
    const onTimeRate = h.deliveredOrders ? h.onTimeDeliveries / h.deliveredOrders : null;
    /** @type {number[]} */
    const perfParts = /** @type {number[]} */ ([qcRate, onTimeRate].filter((x) => x !== null));
    const performanceScore = hasHistory ? perfParts.reduce((a, b) => a + b, 0) / perfParts.length : 0.5;

    /** @type {ScoreBreakdown} */
    const breakdown = {
      capability: {
        score: capabilityScore,
        weight: weights.capability,
        note: project.requiredCapabilities.length
          ? `${caps.matched.length} of ${project.requiredCapabilities.length} required processes${caps.missing.length ? ` (missing: ${caps.missing.join(", ")})` : ""}`
          : "No specific processes required",
      },
      fabric: {
        score: fabricScore,
        weight: weights.fabric,
        note: project.fabrics.length
          ? `${fabrics.matched.length} of ${project.fabrics.length} fabrics${fabrics.missing.length ? ` (missing: ${fabrics.missing.join(", ")})` : ""}`
          : "No specific fabric required",
      },
      capacity: { score: capacityScore, weight: weights.capacity, note: `About ${Math.floor(windowCapacity)} units of free capacity before the deadline` },
      leadTime: {
        score: leadScore,
        weight: weights.leadTime,
        note: daysAvailable === null ? "No deadline set" : `${c.typicalLeadTimeDays}-day lead time against ${daysAvailable} days available`,
      },
      location: {
        score: locationScore,
        weight: weights.location,
        note: project.preferredCountry ? (locationScore ? `Located in ${c.country} as preferred` : `Located in ${c.country}, not ${project.preferredCountry}`) : "No location preference",
      },
      performance: {
        score: performanceScore,
        weight: weights.performance,
        note: hasHistory
          ? [qcRate !== null && `${Math.round(qcRate * 100)}% QC pass rate`, onTimeRate !== null && `${Math.round(onTimeRate * 100)}% on-time deliveries`].filter(Boolean).join(", ")
          : "No completed orders on Fashinza yet (neutral score)",
      },
    };
    const score = round2(Object.values(breakdown).reduce((sum, b) => sum + b.score * b.weight, 0));
    const reasons = [
      "Verified factory that makes this category",
      `MOQ ${c.minOrderQuantity} fits the order of ${project.quantity}`,
      ...(project.requiredCertifications.length ? [`Holds verified ${certs.matched.join(", ")}`] : []),
      ...Object.values(breakdown).map((b) => b.note),
    ];
    outcome.eligible.push({ manufacturerId: c.manufacturerId, name: c.name, score, breakdown, reasons });
  }

  outcome.eligible.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
  return outcome;
}
