import type { Chart, Citation, EvidenceDoc, Mods, Proposal, ProposalContent, ScenarioKey } from "../types";
import { dedupe, findAnchor, resolveAll } from "./corpus";
import { current, rowById } from "./chart";
import { plural } from "./util";

export interface BuildCtx {
  docs: EvidenceDoc[];
  chart: Chart;
  constraints: string[];
  mods: Mods;
  variant?: "missed" | "afterCorrection";
}

export interface NoEvidence {
  rowId: string;
  key: ScenarioKey;
  what: string;
  searched: string;
  closest: Citation[];
  closestNote: string;
  need: string;
}

export type Built =
  | {
      ok: true;
      proposal: Omit<Proposal, "id" | "state" | "revision" | "mods">;
      intro: string;
      steps: string[];
    }
  | { ok: false; noEvidence: NoEvidence; steps: string[] };

type Variants = { formal: string; plain: string; formalShort?: string; plainShort?: string };
const pick = (m: Mods, v: Variants) =>
  m.concise
    ? m.tone === "formal" ? v.formalShort ?? v.formal : v.plainShort ?? v.plain
    : m.tone === "formal" ? v.formal : v.plain;

const EXCLUDE_LITE = (t: string) => /lite \(at-2100\)/i.test(t);
const docsN = (ctx: BuildCtx) => plural(ctx.docs.length, "document");

function before(ctx: BuildCtx, rowId: string): ProposalContent | null {
  const r = rowById(ctx.chart, rowId);
  if (!r) return null;
  const c = current(r);
  if (c.removed) return null;
  return { evidence: c.evidence, reasoning: c.reasoning, source: c.source, status: c.status };
}

const elementText = (ctx: BuildCtx, tag: string) =>
  ctx.chart.elements.find((e) => e.tag === tag)?.text ?? "";

// ===========================================================================
// Element 1 [1a] wireless communication module
// ===========================================================================
function e1Lite(ctx: BuildCtx): Built {
  const steps = [
    "Reading claim element [1a] and the current row",
    `Searching ${docsN(ctx)} for wireless and Wi-Fi language`,
    "Spec sheet ranked above the product page",
    "Drafting evidence and reasoning",
  ];
  const r = resolveAll(ctx.docs, ["Wi-Fi 802.11 b/g/n, 2.4 GHz only"]);
  if (!r.ok) return { ok: false, steps, noEvidence: noSpec(ctx, "e1", "e1_lite", "a technical description of the device's wireless hardware") };
  return {
    ok: true,
    steps,
    intro: "Element 1 is sourced from the product page, which is marketing copy. The spec sheet covers connectivity directly, so here's a version sourced from it.",
    proposal: {
      rowId: "e1",
      key: "e1_lite",
      title: "Element 1 — wireless communication module",
      opLabel: "Strengthen evidence",
      isNewRow: false,
      before: before(ctx, "e1"),
      after: {
        evidence: pick(ctx.mods, {
          formal: "AT-SPEC-3200 Technical Specifications (Rev. C), §2 Model comparison: “Wi-Fi 802.11 b/g/n, 2.4 GHz only” (p. 1).",
          plain: "The spec sheet’s model comparison lists “Wi-Fi 802.11 b/g/n, 2.4 GHz only” (AT-SPEC-3200, p. 1).",
        }),
        reasoning: pick(ctx.mods, {
          formal: "The device includes an IEEE 802.11 Wi-Fi radio, which is a wireless communication module. The specification identifies the protocol and frequency band, replacing the generic product-page statement with a technical source.",
          plain: "The thermostat has a Wi-Fi radio (802.11 b/g/n), which is a wireless communication module. This swaps the product-page claim for a line from the technical spec.",
          formalShort: "The specification lists an IEEE 802.11 b/g/n Wi-Fi radio, which is a wireless communication module.",
          plainShort: "The spec sheet lists a Wi-Fi radio, which is a wireless communication module.",
        }),
        source: "AT-SPEC-3200 Technical Specifications, §2",
        status: "technical",
      },
      citations: r.found,
      confidence: "Medium",
      confidenceNote: "Model variant not confirmed",
      unverified: "This spec sheet covers two models, the SmartTherm Lite and the SmartTherm Pro. I matched the first Wi-Fi line in §2 and haven’t confirmed it describes the AT-3200.",
      ccNote: ctx.mods.cc ? "Low risk. “Wireless communication module” is likely to take its plain meaning, and a Wi-Fi radio fits it." : undefined,
      supports: ["tone", "concise", "cc"],
    },
  };
}

const E1_PRO_ANCHORS = [
  "Wi-Fi 802.11 b/g/n/ac, dual-band 2.4 / 5 GHz",
  "integrates an Espressif ESP32-S3 module providing Wi-Fi and Bluetooth LE radios",
  "received over Wi-Fi and applied within 2 seconds",
];

const E1_PRO_EVIDENCE: Variants = {
  formal: "AT-SPEC-3200 Technical Specifications (Rev. C): the SmartTherm Pro (AT-3200) supports “Wi-Fi 802.11 b/g/n/ac, dual-band 2.4 / 5 GHz” plus Bluetooth 5.0 LE (§2, p. 1), and “integrates an Espressif ESP32-S3 module providing Wi-Fi and Bluetooth LE radios” (§3.1, p. 2). Setpoint commands from the Acme Home app “are received over Wi-Fi and applied within 2 seconds” (§3.1, p. 2).",
  plain: "The spec sheet says the SmartTherm Pro has dual-band Wi-Fi 802.11 b/g/n/ac plus Bluetooth 5.0 LE (p. 1), built on an Espressif ESP32-S3 module (§3.1, p. 2). Temperature changes from the app arrive over Wi-Fi and are applied within 2 seconds (p. 2).",
  formalShort: "AT-SPEC-3200 §3.1: the AT-3200 “integrates an Espressif ESP32-S3 module providing Wi-Fi and Bluetooth LE radios” (p. 2).",
  plainShort: "Spec sheet §3.1: the Pro uses an ESP32-S3 Wi-Fi and Bluetooth module (p. 2).",
};

function e1Pro(ctx: BuildCtx): Built {
  const steps = [
    "Applying session correction: SmartTherm Pro (AT-3200) lines only",
    `Searching ${docsN(ctx)} for wireless and Wi-Fi language`,
    "Excluded 1 SmartTherm Lite passage",
    "Found the Pro connectivity line and the §3.1 hardware section",
    "Drafting evidence and reasoning",
  ];
  const r = resolveAll(ctx.docs, E1_PRO_ANCHORS, [], { exclude: EXCLUDE_LITE });
  if (!r.ok) return { ok: false, steps, noEvidence: noSpec(ctx, "e1", "e1_pro", "a description of the AT-3200’s wireless module") };
  return {
    ok: true,
    steps,
    intro: ctx.variant === "afterCorrection"
      ? "Here’s element 1 sourced from SmartTherm Pro lines only, including the hardware section that names the module."
      : "Element 1 is sourced from the product page, which is marketing copy. The spec sheet’s hardware section names the actual module, so here’s a version sourced from it.",
    proposal: {
      rowId: "e1",
      key: "e1_pro",
      title: "Element 1 — wireless communication module",
      opLabel: "Strengthen evidence",
      isNewRow: false,
      before: before(ctx, "e1"),
      after: {
        evidence: pick(ctx.mods, E1_PRO_EVIDENCE),
        reasoning: pick(ctx.mods, {
          formal: "The AT-3200 is a temperature control device that integrates a discrete wireless communication module, an Espressif ESP32-S3 providing Wi-Fi and Bluetooth LE. The module serves the device’s control function: setpoint commands are received over Wi-Fi and applied within two seconds. That ties the module to the temperature control device rather than treating Wi-Fi as an incidental feature.",
          plain: "The Pro model has a dedicated wireless module (an ESP32-S3) that handles Wi-Fi and Bluetooth. It’s part of how the thermostat controls temperature: changes from the app arrive over Wi-Fi and are applied within two seconds.",
          formalShort: "The AT-3200 integrates an ESP32-S3 wireless communication module that receives setpoint commands over Wi-Fi, so the module is part of the temperature control device.",
          plainShort: "The Pro has a built-in ESP32-S3 Wi-Fi and Bluetooth module that receives temperature commands from the app.",
        }),
        source: "AT-SPEC-3200 Technical Specifications, §2 and §3.1",
        status: "technical",
      },
      citations: r.found,
      confidence: "High",
      unverified: "Nothing material. The ESP32-S3 is named in the spec sheet; a teardown would confirm it physically.",
      ccNote: ctx.mods.cc ? "Low risk. “Wireless communication module” should take its plain meaning; an integrated radio module identified by part number satisfies it." : undefined,
      supports: ["tone", "concise", "cc"],
    },
  };
}

function e1Legal(ctx: BuildCtx): Built {
  const steps = [
    "Reading claim element [1a]",
    "Identifying likely construction disputes: “module”, and its link to temperature control",
    "Drafting reasoning that answers both",
  ];
  const r = resolveAll(ctx.docs, E1_PRO_ANCHORS, [], { exclude: EXCLUDE_LITE });
  if (!r.ok) return { ok: false, steps, noEvidence: noSpec(ctx, "e1", "e1_legal", "a description of the AT-3200’s wireless module") };
  const cur = rowById(ctx.chart, "e1");
  const keep = cur && current(cur).keys.includes("e1_pro");
  return {
    ok: true,
    steps,
    intro: "Element 1’s construction exposure is narrow, but there is one argument worth closing off: that the module has to serve the temperature control function. Here’s reasoning that answers it.",
    proposal: {
      rowId: "e1",
      key: "e1_legal",
      title: "Element 1 — wireless communication module",
      opLabel: "Harden legal language",
      isNewRow: false,
      before: before(ctx, "e1"),
      after: {
        evidence: keep && cur ? current(cur).evidence : pick({ ...ctx.mods, concise: false }, E1_PRO_EVIDENCE),
        reasoning: pick(ctx.mods, {
          formal: "Limitation [1a] requires a temperature control device “with a wireless communication module.” The AT-3200 integrates an Espressif ESP32-S3 module providing Wi-Fi and Bluetooth LE radios (AT-SPEC-3200 §3.1, p. 2). Construction risk is low: “module” should take its plain meaning of a discrete functional component, and a radio module identified by part number satisfies it. Should Acme argue that the module must serve the temperature control function, the record shows setpoint commands are received over Wi-Fi and applied within two seconds (§3.1, p. 2).",
          plain: "The claim needs a temperature control device with a wireless module. The Pro has one: an ESP32-S3 Wi-Fi and Bluetooth module (spec sheet §3.1). If Acme argues the module has to be part of controlling temperature, the spec sheet answers that too, because temperature changes from the app arrive over Wi-Fi and are applied within two seconds.",
        }),
        source: "AT-SPEC-3200 Technical Specifications, §2 and §3.1",
        status: "technical",
      },
      citations: keep && cur ? dedupe([...current(cur).citations, ...r.found]) : r.found,
      confidence: "High",
      unverified: "This is argument, not new evidence. Whether “module” needs a narrower meaning is a question for counsel.",
      supports: ["tone"],
    },
  };
}

// ===========================================================================
// Element 2 [1b] motion sensor for detecting occupancy
// ===========================================================================
const E2_ANCHORS = [
  "The AT-3200 includes a Panasonic EKMC-series passive infrared (PIR) motion sensor",
  "Detection range: up to 5 m",
  "Occupancy state (occupied / unoccupied) is sampled every 30 seconds",
  "the device enters Away mode",
];

const E2_EVIDENCE: Variants = {
  formal: "AT-SPEC-3200 Technical Specifications (Rev. C), §3.2: “The AT-3200 includes a Panasonic EKMC-series passive infrared (PIR) motion sensor,” with a detection range of up to 5 m and a 94-degree field of view (p. 2). “Occupancy state (occupied / unoccupied) is sampled every 30 seconds and reported to the scheduling engine” (p. 2), and after 20 minutes with no detected motion “the device enters Away mode” (p. 2).",
  plain: "Spec sheet §3.2: the Pro has a Panasonic EKMC-series passive infrared (PIR) motion sensor with a 5 m range (p. 2). Every 30 seconds it reports whether the home is occupied to the scheduler, and after 20 minutes with no motion the thermostat switches to Away mode (p. 2).",
  formalShort: "AT-SPEC-3200 §3.2: a Panasonic EKMC-series PIR motion sensor whose output is sampled as an occupied / unoccupied state every 30 seconds (p. 2).",
  plainShort: "Spec sheet §3.2: a PIR motion sensor that reports occupied or unoccupied every 30 seconds (p. 2).",
};

function e2Pir(ctx: BuildCtx): Built {
  const steps = [
    "Reading claim element [1b] and the current row",
    `Searching ${docsN(ctx)} for motion, occupancy and PIR language`,
    "Spec sheet §3.2 has component-level detail",
    "Drafting evidence and reasoning",
  ];
  const r = resolveAll(ctx.docs, E2_ANCHORS);
  if (!r.ok) return { ok: false, steps, noEvidence: noSpec(ctx, "e2", "e2_pir", "a hardware description of the occupancy sensor") };
  return {
    ok: true,
    steps,
    intro: "The current evidence quotes the one-line overview from the spec sheet. Section 3.2 of the same document has the hardware detail: the sensor part, its range, and more usefully, how occupancy state is actually used.",
    proposal: {
      rowId: "e2",
      key: "e2_pir",
      title: "Element 2 — motion sensor for detecting occupancy",
      opLabel: "Strengthen evidence",
      isNewRow: false,
      before: before(ctx, "e2"),
      after: {
        evidence: pick(ctx.mods, E2_EVIDENCE),
        reasoning: pick(ctx.mods, {
          formal: "The AT-3200’s PIR sensor is a motion sensor, identified by component family in the specification. It is used for detecting occupancy: its output is converted into an occupied / unoccupied state, sampled every 30 seconds, reported to the scheduling engine, and used to switch the device into Away mode. The evidence now establishes both the claimed structure (a named motion sensor) and the claimed function (occupancy detection), instead of resting on a one-line product summary.",
          plain: "The thermostat has a passive infrared motion sensor, a specific Panasonic part. Its job is working out whether anyone is home: every 30 seconds it reports occupied or unoccupied to the scheduler, and after 20 minutes without motion the thermostat switches to Away mode. That covers both what the sensor is and what it’s used for.",
          formalShort: "The AT-3200’s PIR motion sensor (Panasonic EKMC series) outputs an occupancy state that is sampled every 30 seconds and drives Away mode, which meets both the structure and the “detecting occupancy” function.",
          plainShort: "It has a PIR motion sensor that reports whether the home is occupied every 30 seconds, which is what the claim describes.",
        }),
        source: "AT-SPEC-3200 Technical Specifications, §3.2",
        status: "technical",
      },
      citations: r.found,
      confidence: "High",
      unverified: "The specification names the sensor family (EKMC series), not an exact part number. A teardown would confirm the populated component.",
      ccNote: ctx.mods.cc
        ? ctx.mods.tone === "formal"
          ? "If “for detecting occupancy” is construed to require presence detection rather than motion detection, Acme may argue a PIR sensor only detects movement. The 20-minute Away logic shows the motion signal is used as an occupancy determination, which narrows that argument."
          : "Acme could argue a motion sensor only sees movement, not whether someone is home. The Away-mode logic shows Acme itself uses it to decide whether the home is occupied."
        : undefined,
      supports: ["tone", "concise", "cc"],
    },
  };
}

function e2Legal(ctx: BuildCtx): Built {
  const steps = ["Reading claim element [1b]", "Identifying the likely dispute: motion detection versus presence detection", "Drafting reasoning that answers it"];
  const r = resolveAll(ctx.docs, E2_ANCHORS);
  if (!r.ok) return { ok: false, steps, noEvidence: noSpec(ctx, "e2", "e2_legal", "a hardware description of the occupancy sensor") };
  const cur = rowById(ctx.chart, "e2");
  const keep = cur && current(cur).keys.includes("e2_pir");
  return {
    ok: true,
    steps,
    intro: "The construction fight on element 2 will be over “detecting occupancy”: whether a sensor that sees motion is detecting presence. Here’s reasoning that takes that on directly.",
    proposal: {
      rowId: "e2",
      key: "e2_legal",
      title: "Element 2 — motion sensor for detecting occupancy",
      opLabel: "Harden legal language",
      isNewRow: false,
      before: before(ctx, "e2"),
      after: {
        evidence: keep && cur ? current(cur).evidence : pick({ ...ctx.mods, concise: false }, E2_EVIDENCE),
        reasoning: pick(ctx.mods, {
          formal: "Limitation [1b] requires a motion sensor “for detecting occupancy.” The AT-3200’s PIR sensor satisfies both parts under any reasonable construction. A PIR sensor is a motion sensor by definition. If Acme argues that “detecting occupancy” requires presence detection rather than motion detection, the record answers it: the sensor’s output is converted into an occupied / unoccupied state every 30 seconds and used to switch the device into Away mode after 20 minutes without motion (AT-SPEC-3200 §3.2, p. 2). The motion signal is therefore used as an occupancy determination, which is what the claim recites.",
          plain: "The claim needs a motion sensor used to detect whether someone’s home. A PIR sensor is a motion sensor. If Acme says sensing motion isn’t the same as detecting occupancy, its own spec sheet disagrees: the thermostat turns the motion signal into an occupied or unoccupied state every 30 seconds and goes to Away mode after 20 minutes without motion.",
        }),
        source: "AT-SPEC-3200 Technical Specifications, §3.2",
        status: "technical",
      },
      citations: keep && cur ? dedupe([...current(cur).citations, ...r.found]) : r.found,
      confidence: "High",
      unverified: "This is argument, not new evidence. How “detecting occupancy” is construed is a question for counsel.",
      supports: ["tone"],
    },
  };
}

// ===========================================================================
// Element 3 [1c] machine learning algorithm
// ===========================================================================
const E3_REQUIRED = [
  "a supervised learning model trained on manual setpoint adjustments",
  "gradient-boosted decision tree (GBDT) regressor with 64 trees",
  "The training target is the setpoint the occupant selected manually",
  "retrained nightly at 02:00 local time on a rolling 21-day window",
  "the override becomes a new training label",
];
const E3_FIELD = "Median prediction error falls from 1.8";
const E3_DEVICE = "Training and inference run on the thermostat's Cortex-M4F processor";
const E3_CONTEXT = ["describes the algorithm as designed for firmware 5.x", "Shipping firmware for the AT-3200: version 5.4.2"];

function e3Evidence(m: Mods): string {
  if (m.concise) {
    let s = "AT-WP-07 (v2.1): Auto-Schedule is “a gradient-boosted decision tree (GBDT) regressor” trained on manual setpoint adjustments (p. 1), “retrained nightly at 02:00 local time on a rolling 21-day window” (p. 2).";
    if (m.onDevice) s += " Training and inference run on the device (p. 2).";
    return s;
  }
  let s = "Acme engineering whitepaper AT-WP-07 (v2.1, March 2024) states that Auto-Schedule predictions come from “a supervised learning model trained on manual setpoint adjustments” (p. 1), and that the model is “a gradient-boosted decision tree (GBDT) regressor with 64 trees” (p. 1). “The training target is the setpoint the occupant selected manually” (p. 1). The model is “retrained nightly at 02:00 local time on a rolling 21-day window of examples” (p. 2), and when an occupant overrides a prediction, “the override becomes a new training label” (p. 2).";
  if (m.fieldData) s += " Acme reports median prediction error falling from 1.8 °C in week one to 0.6 °C by week four (p. 2).";
  if (m.onDevice) s += " “Training and inference run on the thermostat’s Cortex-M4F processor” (p. 2).";
  return s;
}

function e3Reasoning(m: Mods): string {
  if (m.concise) {
    let s = m.tone === "formal"
      ? "Auto-Schedule is a GBDT regressor, a supervised machine learning algorithm, trained on the occupant’s manual setpoints, which are the user’s temperature preferences. It learns over time through nightly retraining on a rolling 21-day window, with overrides added as new labels."
      : "It’s a machine learning model trained on the temperatures the user picks, and it retrains every night on the last 21 days, so it learns their preferences over time.";
    if (m.onDevice) s += m.tone === "formal" ? " Training occurs on the accused device." : " It all runs on the thermostat.";
    return s;
  }
  let s = m.tone === "formal"
    ? "The SmartTherm Pro practices limitation [1c]. Auto-Schedule is a gradient-boosted decision tree regressor, which is a supervised machine learning algorithm. Its training target is the setpoint the occupant selects by hand, so what the model learns is the user’s temperature preference. The “over time” requirement is met by the nightly retraining cycle over a rolling 21-day window, in which every manual adjustment, and every override of a predicted setpoint, becomes a new training label."
    : "Auto-Schedule is a real machine learning model, not a fixed scheduling rule. It’s a gradient-boosted decision tree trained on the temperatures the user sets by hand, and those settings are the user’s preferences. It learns over time because it retrains every night on the last 21 days of adjustments, and every override of a prediction becomes new training data.";
  if (m.fieldData)
    s += m.tone === "formal"
      ? " Acme’s own field data shows prediction error falling from 1.8 °C to 0.6 °C over four weeks, which is direct evidence that the learned preference improves with use."
      : " Acme’s own numbers show prediction error dropping from 1.8 °C to 0.6 °C over four weeks.";
  if (m.onDevice)
    s += m.tone === "formal"
      ? " Because training and inference run on the device’s own processor, the learning occurs within the accused product itself rather than in a remote service."
      : " All of this happens on the thermostat itself, not in the cloud.";
  return s;
}

function noWhitepaper(ctx: BuildCtx, key: ScenarioKey): NoEvidence {
  const closest = [
    findAnchor(ctx.docs, "Auto-Schedule learns your preferred temperatures", { role: "context" }),
    findAnchor(ctx.docs, "Algorithm details are described in Acme engineering whitepaper AT-WP-07", { role: "context" }),
  ].filter(Boolean) as Citation[];
  return {
    rowId: "e3",
    key,
    what: "a technical description of how Auto-Schedule learns",
    searched: `I searched ${docsN(ctx)} for model type, training data, retraining and learning language.`,
    closest,
    closestNote: closest.some((c) => /AT-WP-07/.test(c.text))
      ? "The spec sheet points to engineering whitepaper AT-WP-07 for the algorithm, and that document isn’t in your uploads."
      : "The only matches are marketing statements that describe learning without saying how it works.",
    need: "The AT-WP-07 whitepaper, source code, or an engineering design document would settle it.",
  };
}

function e3Ml(ctx: BuildCtx): Built {
  const steps = [
    "Reading claim element [1c] and the current row",
    `Searching ${docsN(ctx)} for model, training and learning language`,
    "Whitepaper AT-WP-07 ranked above the brochure",
    "Drafting evidence and reasoning",
    "Checking what the sources don’t establish",
  ];
  const optional = [...(ctx.mods.fieldData ? [E3_FIELD] : []), ...(ctx.mods.onDevice ? [E3_DEVICE] : [])];
  const r = resolveAll(ctx.docs, E3_REQUIRED, optional);
  if (!r.ok) return { ok: false, steps, noEvidence: noWhitepaper(ctx, "e3_ml") };
  const context = E3_CONTEXT.map((a) => findAnchor(ctx.docs, a, { role: "context" })).filter(Boolean) as Citation[];
  return {
    ok: true,
    steps,
    intro: "Agreed. The current reasoning infers machine learning from a brochure line, and says as much. The engineering whitepaper describes the actual algorithm, so I’ve rewritten both cells for element 3 from that source.",
    proposal: {
      rowId: "e3",
      key: "e3_ml",
      title: "Element 3 — machine learning algorithm",
      opLabel: "Fix reasoning and strengthen evidence",
      isNewRow: false,
      before: before(ctx, "e3"),
      after: {
        evidence: e3Evidence(ctx.mods),
        reasoning: e3Reasoning(ctx.mods),
        source: "AT-WP-07 Engineering Whitepaper, §1–4",
        status: "technical",
      },
      citations: [...r.found, ...context],
      confidence: "High",
      confidenceNote: "Algorithm high; deployment on shipping units unverified",
      unverified: "The whitepaper describes the algorithm “as designed for firmware 5.x” (p. 3). The spec sheet lists shipping firmware 5.4.2, but nothing in your uploads ties that build to this model. Source code or API documentation would close the gap.",
      ccNote: ctx.mods.cc
        ? ctx.mods.tone === "formal"
          ? "Acme may argue that “learns … over time” requires continuous, online learning and that nightly batch retraining does not qualify. This reasoning grounds “over time” in the repeated retraining cycle and the measured error reduction, rather than in real-time adaptation."
          : "Acme might argue “learns over time” means learning continuously, not once a night. The reasoning answers that by pointing to repeated retraining and the error dropping week by week."
        : undefined,
      supports: ["tone", "concise", "cc", "onDevice", "fieldData"],
    },
  };
}

function e3Legal(ctx: BuildCtx): Built {
  const steps = [
    "Reading claim element [1c]",
    "Identifying the likely dispute: whether nightly retraining is learning “over time”",
    "Drafting reasoning that holds under both readings",
  ];
  const r = resolveAll(ctx.docs, E3_REQUIRED, [E3_FIELD]);
  if (!r.ok) return { ok: false, steps, noEvidence: noWhitepaper(ctx, "e3_legal") };
  const cur = rowById(ctx.chart, "e3");
  const cv = cur ? current(cur) : null;
  const keep = !!cv && cv.keys.includes("e3_ml");
  const hasApi = !!cv && cv.keys.includes("e3_deploy");
  let reasoning = pick(ctx.mods, {
    formal: "Auto-Schedule meets limitation [1c] under any reasonable construction. Given its ordinary meaning, a “machine learning algorithm” is one that improves its outputs from data; the GBDT regressor qualifies because it is fitted to labelled examples and its predictions change as examples accumulate. If Acme contends that “learns … over time” requires continuous online learning, nothing in the claim language says so. “Over time” is satisfied by repeated retraining at fixed intervals, and the record shows nightly retraining on a rolling 21-day window with overrides incorporated as new labels (AT-WP-07, p. 2). The measured fall in prediction error from 1.8 °C to 0.6 °C over four weeks confirms the learning is cumulative, not a one-time configuration (AT-WP-07, p. 2).",
    plain: "Whichever way the court reads this element, Auto-Schedule fits. It’s machine learning in the ordinary sense: it’s trained on data, and its predictions change as it gets more. If Acme says “over time” has to mean continuous learning, the claim doesn’t say that, and retraining every night on a rolling window is learning over time. The error dropping from 1.8 °C to 0.6 °C in four weeks shows the learning builds up.",
  });
  if (hasApi)
    reasoning += ctx.mods.tone === "formal"
      ? " The model metadata reported by AT-3200 units on shipping firmware 5.4.2 matches this design (Acme API reference v3, p. 1)."
      : " Acme’s API confirms shipping units run this model.";
  return {
    ok: true,
    steps,
    intro: "The construction fight on element 3 will be over “learns … over time”. Here’s reasoning written to hold whether the court reads that broadly or narrowly.",
    proposal: {
      rowId: "e3",
      key: "e3_legal",
      title: "Element 3 — machine learning algorithm",
      opLabel: "Harden legal language",
      isNewRow: false,
      before: before(ctx, "e3"),
      after: {
        evidence: keep && cv ? cv.evidence : e3Evidence({ ...ctx.mods, concise: false, fieldData: true, onDevice: false }),
        reasoning,
        source: keep && cv ? cv.source : "AT-WP-07 Engineering Whitepaper, §1–4",
        status: "technical",
      },
      citations: keep && cv ? dedupe([...cv.citations, ...r.found]) : r.found,
      confidence: "Medium",
      confidenceNote: "Depends on how “over time” is construed",
      unverified: "This is argument, not new evidence. Whether “over time” excludes batch retraining is a claim construction question for counsel; I’ve drafted the strongest reading the record supports.",
      supports: ["tone"],
    },
  };
}

const E3_API = [
  "Example response, SmartTherm Pro (AT-3200), firmware 5.4.2",
  "gbdt_regressor",
  "training_window_days",
  "daily@02:00",
];

function e3Deploy(ctx: BuildCtx): Built | { ok: "needsFirst" } {
  const steps = [
    "Reading element 3’s open question: does shipping firmware run this model?",
    `Searching ${docsN(ctx)} for source code, API documentation, firmware notes and model metadata`,
  ];
  const r = resolveAll(ctx.docs, E3_API, [], { classes: ["api", "technical", "other"] });
  if (!r.ok) {
    const closest = E3_CONTEXT.map((a) => findAnchor(ctx.docs, a, { role: "context" })).filter(Boolean) as Citation[];
    return {
      ok: false,
      steps: [...steps, "No source code or API documentation found"],
      noEvidence: {
        rowId: "e3",
        key: "e3_deploy",
        what: "anything that ties the Auto-Schedule model to the firmware shipping on accused units",
        searched: `I searched ${docsN(ctx)} for source code, API documentation, firmware build notes and model metadata.`,
        closest,
        closestNote: closest.length === 2
          ? "These are related, but nothing links the two: the whitepaper covers “firmware 5.x” in general, and the spec sheet doesn’t say which algorithm 5.4.2 runs."
          : "Nothing in your uploads mentions the firmware that accused units ship with.",
        need: "Source code, an API reference, or a firmware teardown would settle it.",
      },
    };
  }
  const row = rowById(ctx.chart, "e3");
  const cv = row ? current(row) : null;
  if (!cv || !cv.keys.includes("e3_ml")) return { ok: "needsFirst" };
  const add = " Acme Home Developer API reference v3: for “SmartTherm Pro (AT-3200), firmware 5.4.2”, the Auto-Schedule model endpoint reports “model_type”: “gbdt_regressor”, “training_window_days”: 21 and “retrain_schedule”: “daily@02:00” (p. 1).";
  const addR = ctx.mods.tone === "formal"
    ? " The API response for an AT-3200 running shipping firmware 5.4.2 reports the same GBDT model, 21-day training window and nightly retraining schedule described in AT-WP-07, which ties the whitepaper’s design to the accused units as sold."
    : " Acme’s own developer API confirms that Pro units on the shipping firmware run this exact model.";
  return {
    ok: true,
    steps: [...steps, "Found model metadata in the API reference", "Checking it against the whitepaper’s design"],
    intro: "This closes the gap. The API reference reports the model metadata for an AT-3200 on firmware 5.4.2, and it matches the whitepaper’s design. Here’s the addition to element 3.",
    proposal: {
      rowId: "e3",
      key: "e3_deploy",
      title: "Element 3 — machine learning algorithm",
      opLabel: "Strengthen evidence",
      isNewRow: false,
      before: before(ctx, "e3"),
      after: {
        evidence: cv.evidence + add,
        reasoning: cv.reasoning + addR,
        source: `${cv.source}; Acme API reference v3`,
        status: "technical",
      },
      citations: dedupe([...cv.citations.filter((c) => c.role === "support"), ...r.found]),
      confidence: "High",
      unverified: "API documentation shows what the device reports, not its source code. Source code review would be stronger; this is enough to close the deployment gap for the chart.",
      supports: ["tone"],
    },
  };
}

// ===========================================================================
// Element 4 [1d] plurality of temperature sensors (new row)
// ===========================================================================
const E4_ANCHORS = [
  "Onboard sensor: Sensirion SHT40 digital temperature and humidity sensor",
  "up to 6 SmartSensor remote units, each with its own temperature sensor",
  "Readings from all paired sensors are averaged",
];

function e4Sensors(ctx: BuildCtx): Built {
  const steps = [
    "Comparing claim 1’s elements against the chart’s rows",
    "[1d] has no row",
    `Searching ${docsN(ctx)} for temperature sensor and remote sensor language`,
    "Spec sheet §3.3 describes onboard and remote sensors",
    "Drafting a new row",
  ];
  const r = resolveAll(ctx.docs, E4_ANCHORS);
  if (!r.ok) return { ok: false, steps, noEvidence: noSpec(ctx, "e4", "e4_sensors", "a description of the device’s temperature sensors") };
  const ctxCites = [
    findAnchor(ctx.docs, "SmartSensor units are sold separately", { role: "context" }),
    findAnchor(ctx.docs, "Add SmartSensors to keep every room comfortable", { role: "context" }),
  ].filter(Boolean) as Citation[];
  const hasBrochure = ctxCites.some((c) => /every room/i.test(c.text));
  const tag = "[1d]";
  return {
    ok: true,
    steps,
    intro: ctx.variant === "missed"
      ? "You’re right, and the chart was missing the element entirely. Claim 1 recites [1d], a plurality of temperature sensors positioned at different locations within a structure, and no row maps it. The spec sheet supports it, so here’s a new row."
      : "Claim 1 recites a fourth element the chart doesn’t map: [1d], a plurality of temperature sensors positioned at different locations within a structure. The spec sheet supports it, so here’s a new row.",
    proposal: {
      rowId: "e4",
      key: "e4_sensors",
      title: "Element 4 — plurality of temperature sensors",
      opLabel: "Add missing element",
      isNewRow: true,
      newRow: { tag, element: elementText(ctx, tag) || "A plurality of temperature sensors positioned at different locations within a structure" },
      before: null,
      after: {
        evidence: pick(ctx.mods, {
          formal: `AT-SPEC-3200 Technical Specifications (Rev. C), §3.3: an “Onboard sensor: Sensirion SHT40 digital temperature and humidity sensor” plus “up to 6 SmartSensor remote units, each with its own temperature sensor” (p. 2). “Readings from all paired sensors are averaged, or weighted by occupancy when Follow Me is enabled” (p. 2).${hasBrochure ? " Supporting, marketing: the brochure invites users to “Add SmartSensors to keep every room comfortable.”" : ""}`,
          plain: `Spec sheet §3.3: the thermostat has its own temperature sensor (a Sensirion SHT40) and supports up to 6 SmartSensor remote units, each with its own temperature sensor (p. 2). It averages readings from all paired sensors (p. 2).${hasBrochure ? " The brochure, which is marketing, pitches SmartSensors for “every room”." : ""}`,
          formalShort: "AT-SPEC-3200 §3.3: onboard SHT40 sensor plus “up to 6 SmartSensor remote units, each with its own temperature sensor,” whose readings are averaged (p. 2).",
          plainShort: "Spec sheet §3.3: an onboard sensor plus up to 6 remote SmartSensors, averaged together (p. 2).",
        }),
        reasoning: pick(ctx.mods, {
          formal: `With one or more SmartSensor units paired, the AT-3200 system includes a plurality of temperature sensors: the onboard SHT40 and each remote unit’s sensor. The thermostat aggregates their readings, averaging them or weighting them by occupancy, which shows the sensors operate together as part of the claimed system rather than as unrelated accessories.${hasBrochure ? " Placement at different locations follows from the product’s purpose and the brochure’s room-by-room language." : ""}`,
          plain: `Once you pair a SmartSensor, the system has more than one temperature sensor: the one in the thermostat and one in each remote unit. The thermostat combines their readings, so they work as one system.${hasBrochure ? " The brochure’s “every room” pitch shows they’re meant to sit in different rooms." : ""}`,
          formalShort: "With SmartSensors paired, the system has multiple temperature sensors (onboard SHT40 plus remote units) whose readings the thermostat aggregates.",
          plainShort: "Paired SmartSensors plus the onboard sensor give it several temperature sensors that work together.",
        }),
        source: "AT-SPEC-3200 Technical Specifications, §3.3",
        status: "technical",
      },
      citations: [...r.found, ...ctxCites],
      confidence: "Medium",
      confidenceNote: "Placement rests on marketing copy",
      unverified: "The spec sheet says the units are remote, not that they are “positioned at different locations within a structure.” That placement rests on the brochure, which is marketing copy. SmartSensors are also sold separately, so whether accused units are used with them is a question for counsel, not the chart.",
      ccNote: ctx.mods.cc
        ? "“Positioned at different locations within a structure” invites an argument that the claim requires the sensors to be installed as part of the system. Because SmartSensor units are sold separately, Acme’s likely position is that the device as sold does not meet [1d]. That is a question of who infringes, directly or indirectly, and should be flagged for counsel."
        : undefined,
      supports: ["tone", "concise", "cc"],
    },
  };
}

function e4Legal(ctx: BuildCtx): Built | { ok: "needsFirst" } {
  const row = rowById(ctx.chart, "e4");
  if (!row || current(row).removed) return { ok: "needsFirst" };
  const steps = ["Reading claim element [1d]", "Identifying the likely dispute: sensors sold separately", "Drafting reasoning that separates infringement from who infringes"];
  const r = resolveAll(ctx.docs, E4_ANCHORS, ["SmartSensor units are sold separately"]);
  if (!r.ok) return { ok: false, steps, noEvidence: noSpec(ctx, "e4", "e4_legal", "a description of the device’s temperature sensors") };
  const cv = current(row);
  return {
    ok: true,
    steps,
    intro: "Element 4’s exposure is that SmartSensors are sold separately. Here’s reasoning that keeps the infringement question apart from the question of who infringes.",
    proposal: {
      rowId: "e4",
      key: "e4_legal",
      title: "Element 4 — plurality of temperature sensors",
      opLabel: "Harden legal language",
      isNewRow: false,
      before: before(ctx, "e4"),
      after: {
        evidence: cv.evidence,
        reasoning: pick(ctx.mods, {
          formal: "Limitation [1d] requires “a plurality of temperature sensors positioned at different locations within a structure.” With at least one SmartSensor paired, the AT-3200 system has two or more temperature sensors: the onboard SHT40 and each remote unit (AT-SPEC-3200 §3.3, p. 2). Acme’s likely argument is that remote units are sold separately, so the device as sold does not include a plurality of sensors. That goes to who infringes, directly or indirectly, rather than to whether the configured system meets the limitation; the spec sheet’s averaging logic shows the system is designed to operate with multiple sensors (§3.3, p. 2).",
          plain: "The claim needs several temperature sensors in different places. With a SmartSensor paired, the system has at least two. Acme will say the remote sensors are sold separately, so the thermostat on its own doesn’t have several. That’s really a question about who infringes, not whether the set-up matches the claim, and the spec sheet shows the system is built to combine readings from several sensors.",
        }),
        source: cv.source,
        status: cv.status,
      },
      citations: dedupe([...cv.citations, ...r.found]),
      confidence: "Medium",
      confidenceNote: "Depends on direct versus indirect infringement theory",
      unverified: "Placement “at different locations within a structure” still rests on the brochure’s room-by-room language, which is marketing copy. An installation guide would be stronger.",
      supports: ["tone"],
    },
  };
}

// ===========================================================================
function noSpec(ctx: BuildCtx, rowId: string, key: ScenarioKey, what: string): NoEvidence {
  const marketing = ctx.docs.filter((d) => d.sourceClass === "marketing").length;
  return {
    rowId,
    key,
    what,
    searched: `I searched ${docsN(ctx)}${marketing ? `, ${marketing} of them marketing material` : ""}.`,
    closest: [],
    closestNote: "Nothing in your uploads describes this at a technical level.",
    need: "The AT-SPEC-3200 technical specifications, a datasheet or a teardown report would settle it.",
  };
}

export type ScenarioBuild = Built | { ok: "needsFirst" };

export function build(key: ScenarioKey, ctx: BuildCtx): ScenarioBuild {
  switch (key) {
    case "e1_lite": return e1Lite(ctx);
    case "e1_pro": return e1Pro(ctx);
    case "e1_legal": return e1Legal(ctx);
    case "e2_pir": return e2Pir(ctx);
    case "e2_legal": return e2Legal(ctx);
    case "e3_ml": return e3Ml(ctx);
    case "e3_legal": return e3Legal(ctx);
    case "e3_deploy": return e3Deploy(ctx);
    case "e4_sensors": return e4Sensors(ctx);
    case "e4_legal": return e4Legal(ctx);
  }
}

/** Which scenario to run for an element + operation, given what's already in the chart. */
export function scenarioFor(rowId: string, op: "strengthen" | "reasoning" | "add" | "legal" | "deploy", constraints: string[]): ScenarioKey | null {
  const proOnly = constraints.includes("exclude-lite");
  if (op === "legal") return ({ e1: "e1_legal", e2: "e2_legal", e3: "e3_legal", e4: "e4_legal" } as Record<string, ScenarioKey>)[rowId] ?? null;
  if (op === "deploy") return rowId === "e3" ? "e3_deploy" : null;
  if (rowId === "e1") return proOnly ? "e1_pro" : "e1_lite";
  if (rowId === "e2") return "e2_pir";
  if (rowId === "e3") return "e3_ml";
  if (rowId === "e4") return "e4_sensors";
  return null;
}
