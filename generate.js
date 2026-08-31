/**
 * DK Copy Studio, generation endpoint.
 *
 * One flow, two doors. A brief produces candidate lines; a line goes straight to
 * the read. From the read onwards everything is identical.
 *
 * Modes:
 *   lines     Brief door. Brief in, six candidate lines out. No finished copy.
 *   diagnose  Read. One line in, DNA plus a competing second reading, a
 *             cross-language verdict, and a proposed spread with reasons.
 *   expand    Spread. Locked DNA plus targets in, adaptation matrix out.
 *   recell    Work. Regenerate one cell against a named reason.
 *   brief     Express lane. Skips the read and writes finished copy directly.
 *
 * The Anthropic key lives in the Netlify env var ANTHROPIC_API_KEY.
 * It is never hardcoded and never sent to the browser.
 */

const { SKILL_DK } = require("./skill-dk.js");

const MODEL = "claude-sonnet-4-6";
const API_URL = "https://api.anthropic.com/v1/messages";
const API_VERSION = "2023-06-01";

const MAX_TOKENS = {
  lines: 1500,
  diagnose: 2500,
  expand: 8000,
  recell: 1500,
  brief: 4000,
};

/* ------------------------------------------------------------------ *
 * Language handling
 * ------------------------------------------------------------------ */

function languageDirective(lang) {
  if (lang === "da") {
    return [
      "OUTPUTSPROG: DANSK.",
      "Skriv alt output på dansk. Ikke oversat fra engelsk, men tænkt på dansk.",
      "Alle danske sprogregler i skillet gælder fuldt ud, især særskrivning,",
      "genitiv uden apostrof, konsekvent du eller I, og dansk tal- og datoformat.",
    ].join(" ");
  }

  return [
    "OUTPUT LANGUAGE: ENGLISH, DEBUG MODE.",
    "The tool is being debugged, so render output in English.",
    "You must still think in Danish. Compose each line in Danish first, judge it",
    "against every Danish craft rule in the skill, then render the equivalent in",
    "English. Preserve Danish sentence rhythm, Danish restraint and the Jantelov",
    "test. Do not let English idiom pull the copy into a louder register.",
    "Keep all Danish park names in their correct Danish spelling.",
    "Where a line depends on a Danish mechanic that has no English equivalent, say so",
    "in the notes rather than silently substituting an English pun.",
    "This output is for debugging only and is not publication ready.",
  ].join(" ");
}

function sourceDirective(srcLang) {
  if (!srcLang || srcLang === "da") return "";
  const names = { nl: "Dutch", en: "English", de: "German" };
  const n = names[srcLang] || srcLang;
  return [
    "",
    "SOURCE LANGUAGE: " + n + ".",
    "The seed line was written in " + n + ", not Danish. Step 7e of the skill applies.",
    "Before anything is expanded you must decide explicitly whether the mechanic",
    "survives directly, survives adapted, or does not survive at all. If it does not",
    "survive, build a new Danish mechanic on the same DNA rather than translating.",
    "Never hide a loss. Say what went and what was built in its place.",
  ].join("\n");
}

const ABSOLUTE_RULES = [
  "ABSOLUTE RULES, these override everything else:",
  "1. Never use an em dash or an en dash. Not in copy, not in notes, not anywhere.",
  "   Use a comma, a colon or a full stop instead.",
  "2. The brand is Landal. Never write Landal GreenParks. The rebrand dropped it.",
  "3. Never invent specifics. No invented prices, dates, park names, facilities,",
  "   distances or statistics. Use a bracketed placeholder instead, for example",
  "   [BELØB, fx 750 kr.] or [DATO] or [PARKNAVN].",
  "4. No exclamation marks in brand copy.",
  "5. Respect the character limits given for the platform. Going over is a failure,",
  "   not a stylistic choice.",
  "6. Output only the requested delimited structure. No preamble, no closing remarks,",
  "   no markdown code fences around the structure.",
].join("\n");

function systemPrompt(lang, srcLang) {
  return (
    SKILL_DK +
    "\n\n---\n\n" +
    languageDirective(lang) +
    sourceDirective(srcLang) +
    "\n\n" +
    ABSOLUTE_RULES
  );
}

/* ------------------------------------------------------------------ *
 * Shared fragments
 * ------------------------------------------------------------------ */

function fmtSpec(spec) {
  if (!spec || !spec.limits) return "No hard character limits.";
  const parts = Object.keys(spec.limits).map(function (k) {
    return k + " max " + spec.limits[k] + " characters";
  });
  let out = "Platform: " + (spec.name || "unspecified") + ". " + parts.join(", ") + ".";
  if (spec.guidance) out += " " + spec.guidance;
  return out;
}

function cellStructure() {
  return [
    "##CELL_START##",
    "##PLATFORM##the platform name exactly as given##/PLATFORM##",
    "##AUDIENCE##the audience name exactly as given##/AUDIENCE##",
    "##FUNNEL##the funnel stage##/FUNNEL##",
    "##HEADLINE##the headline##/HEADLINE##",
    "##BODY##the body copy, may run to several lines##/BODY##",
    "##CTA##the call to action##/CTA##",
    "##SCORE##a number 0 to 100##/SCORE##",
    "##CARRIED##one line on how the DNA survived into this cell##/CARRIED##",
    "##CELL_END##",
  ].join("\n");
}

/* ------------------------------------------------------------------ *
 * Prompt builders
 * ------------------------------------------------------------------ */

function linesPrompt(p) {
  return [
    "This is the brief door. Do not write finished copy. Write candidate lines.",
    "Step 7f of the skill applies.",
    "",
    "Audience: " + (p.audience || "Hot, Conversion Champions (DK)"),
    "Funnel stage: " + (p.funnel || "Consideration"),
    "Park: " + (p.park || "not specified, use [PARKNAVN] if a park is needed"),
    "",
    "What the campaign is about:",
    p.keyMessage || "not specified, infer it from the details below",
    "",
    "Details:",
    p.details || "none given",
    "",
    "Write six candidate lines. Each one must run on a different mechanic, so six",
    "rewordings of the same thought is a failure. Each must stand alone with no",
    "explanation attached. No body copy, no CTA, no channel.",
    "",
    "Use exactly this structure for each and nothing else:",
    "",
    "##LINE_START##",
    "##TEXT##the line itself##/TEXT##",
    "##MECHANIC##the one mechanic it runs on##/MECHANIC##",
    "##LINE_END##",
  ].join("\n");
}

function diagnosePrompt(p) {
  return [
    "This is the read. Do not expand the line yet.",
    "",
    "The line:",
    p.line,
    "",
    "Context given: " + (p.context || "none"),
    "Audiences available: Hot (Conversion Champions), Warm (Brand Explorers), Cold (Future Fans).",
    "Platforms available: " + (p.platformList || []).join(", "),
    "",
    "Work through Step 7a of the skill, then 7d and 7e.",
    "",
    "DNA is the most important output. It is the one idea every future adaptation must",
    "carry. Write it as a single plain sentence that could be handed to a different writer",
    "with no other context. It is a lock, not a summary.",
    "",
    "ALT_DNA is a genuinely competing second reading of the same line, per Step 7d.",
    "Test it: would the two DNAs produce different headlines on the same platform? If not,",
    "it is the same thought reworded and you must find a real alternative.",
    "",
    "CROSSING is the Step 7e verdict. Say survives_direct, survives_adapted or",
    "survives_not, then explain in one line. If the source language is Danish, say",
    "survives_direct and note that no crossing was needed.",
    "",
    "SPREAD is your recommendation for where this line should go. Choose from the",
    "platforms listed above only. Include the platforms and audiences you would run, and",
    "list the platforms you would deliberately skip with the reason. Be willing to skip.",
    "A line that suits three platforms well should not be forced onto eight.",
    "",
    "Use exactly this structure and nothing else:",
    "",
    "##DIAGNOSIS_START##",
    "##DNA##",
    "the single locked idea, one sentence",
    "##/DNA##",
    "##ALT_DNA##",
    "the competing second reading, one sentence",
    "##/ALT_DNA##",
    "##ALT_WHY##",
    "one line on how the two readings would diverge in practice",
    "##/ALT_WHY##",
    "##MECHANIC##",
    "how the line works: contrast, understatement, double meaning, observation,",
    "concrete number, unexpected word choice, or something else",
    "##/MECHANIC##",
    "##PROMISE##",
    "the emotional promise made to the reader, one sentence",
    "##/PROMISE##",
    "##REGISTER##",
    "one of: Varm uformel, Roligt overbevisende, Sagligt klart, Kulturelt vågent",
    "##/REGISTER##",
    "##FUNNEL##",
    "one of: Awareness, Consideration, Conversion",
    "##/FUNNEL##",
    "##CROSSING##",
    "survives_direct or survives_adapted or survives_not",
    "##/CROSSING##",
    "##CROSSING_WHY##",
    "one line. If it does not survive, say what was lost and what should be built instead.",
    "##/CROSSING_WHY##",
    "##FIT##",
    "a number 0 to 100 for how well the line already sits in the Landal voice",
    "##/FIT##",
    "##FIT_WHY##",
    "one line explaining that score, including anything that pulls it down",
    "##/FIT_WHY##",
    "##RISKS##",
    "- first risk",
    "- second risk",
    "##/RISKS##",
    "##PLATFORMS##",
    "comma separated platform names, taken only from the list above",
    "##/PLATFORMS##",
    "##AUDIENCES##",
    "comma separated, from Hot, Warm, Cold",
    "##/AUDIENCES##",
    "##SPREAD_WHY##",
    "one line on why this spread and not a wider one",
    "##/SPREAD_WHY##",
    "##SKIP##",
    "- Platform name | the reason to skip it",
    "- Platform name | the reason to skip it",
    "##/SKIP##",
    "##DIAGNOSIS_END##",
  ].join("\n");
}

function expandPrompt(p) {
  const combos = [];
  (p.platforms || []).forEach(function (plat) {
    (p.audiences || []).forEach(function (aud) {
      combos.push({ plat: plat, aud: aud });
    });
  });

  const lines = [
    "Expand the seed line across the requested platforms and audiences.",
    "This is Step 7b of the skill. Follow its rules exactly.",
    "",
    "SEED LINE:",
    p.line,
    "",
    "LOCKED DNA, every single cell must carry this:",
    p.dna,
    "",
    "MECHANIC to preserve, preserve the mechanic, not the words:",
    p.mechanic || "not specified",
    "",
    "EMOTIONAL PROMISE:",
    p.promise || "not specified",
    "",
  ];

  if (p.crossing === "survives_not") {
    lines.push(
      "CROSSING NOTE: the original mechanic does not survive into the output language.",
      "Build a new mechanic on the same DNA. Do not translate the original.",
      p.crossingWhy || "",
      ""
    );
  }

  lines.push(
    "FUNNEL STAGE: " + (p.funnel || "match each cell to what the platform naturally does"),
    "",
    "Produce one cell for each of the following combinations. Do not skip any.",
    "Do not add any that are not listed.",
    ""
  );

  combos.forEach(function (c, i) {
    const spec = (p.specs || {})[c.plat];
    lines.push(
      i + 1 + ". Platform: " + c.plat + " | Audience: " + c.aud + " | " + fmtSpec(spec)
    );
  });

  lines.push(
    "",
    "Rules for this expansion:",
    "- If a cell no longer carries the DNA, it is wrong, however good the line is alone.",
    "- Hot, Warm and Cold audiences hear the same idea at a different pitch. Do not give",
    "  them different messages.",
    "- Awareness must not sell. Conversion must remove the last doubt, not build mood.",
    "- A short frame is a new line, not the long line with words cut off.",
    "- If the seed depends on wordplay that does not cross into this platform or audience,",
    "  build a new mechanic on the same DNA and say so in the CARRIED field.",
    "",
    "Use exactly this structure for every cell and nothing else:",
    "",
    cellStructure()
  );

  return lines.join("\n");
}

function recellPrompt(p) {
  return [
    "Regenerate one single cell. Everything else in the matrix stays as it is.",
    "",
    "SEED LINE:",
    p.line,
    "",
    "LOCKED DNA, this cell must carry it:",
    p.dna,
    "",
    "MECHANIC:",
    p.mechanic || "not specified",
    "",
    "Cell to regenerate:",
    "Platform: " + p.platform,
    "Audience: " + p.audience,
    "Funnel stage: " + (p.funnel || "as appropriate to the platform"),
    fmtSpec(p.spec),
    "",
    "The previous attempt was:",
    p.previous || "none",
    "",
    "What was wrong with it:",
    p.reason || "Take a different angle. Same DNA, different mechanic or entry point.",
    "",
    "Fix that specific problem. Do not simply reword the previous attempt, and do not",
    "drift off the DNA while fixing it.",
    "",
    "Return exactly one cell in this structure and nothing else:",
    "",
    cellStructure(),
  ].join("\n");
}

function briefPrompt(p) {
  return [
    "Express lane. Write finished Landal copy directly from this brief.",
    "",
    "Content type: " + (p.contentType || "social caption"),
    "Audience: " + (p.audience || "Hot, Conversion Champions (DK)"),
    "Funnel stage: " + (p.funnel || "Consideration"),
    "Register: " + (p.register || "Varm uformel"),
    "Park: " + (p.park || "not specified, use [PARKNAVN] if a park is needed"),
    "",
    "Core message:",
    p.keyMessage || "not specified, infer the single idea from the details below",
    "",
    "Practical details:",
    p.details || "none given",
    "",
    fmtSpec(p.spec),
    "",
    "Produce " + (p.variantCount || 3) + " distinct variants. Distinct means a different",
    "angle or mechanic, not the same line reworded. Score each one 0 to 100 on how well",
    "it holds the Landal voice and lands the single core message.",
    "",
    "Use exactly this structure for each variant and nothing else:",
    "",
    "##VARIANT_START##",
    "##SCORE: 87##",
    "##WHY: one short line on what this variant is doing##",
    "[the copy, formatted as it would appear in the real channel]",
    "##VARIANT_END##",
  ].join("\n");
}

const BUILDERS = {
  lines: linesPrompt,
  diagnose: diagnosePrompt,
  expand: expandPrompt,
  recell: recellPrompt,
  brief: briefPrompt,
};

/* ------------------------------------------------------------------ *
 * Handler
 * ------------------------------------------------------------------ */

function json(statusCode, body) {
  return {
    statusCode: statusCode,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
    body: JSON.stringify(body),
  };
}

exports.handler = async function (event) {
  if (event.httpMethod !== "POST") return json(405, { error: "Use POST." });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return json(500, {
      error:
        "ANTHROPIC_API_KEY is not set on this Netlify site. Add it under " +
        "Site configuration, Environment variables, then redeploy. Note that a 529 " +
        "from the API is a different problem: that is upstream overload, not a missing key.",
    });
  }

  let payload;
  try {
    payload = JSON.parse(event.body || "{}");
  } catch (err) {
    return json(400, { error: "Request body was not valid JSON." });
  }

  const mode = payload.mode || "diagnose";
  const build = BUILDERS[mode];
  if (!build) {
    return json(400, {
      error:
        "Unknown mode: " + mode + ". Expected lines, diagnose, expand, recell or brief.",
    });
  }

  if (["diagnose", "expand", "recell"].indexOf(mode) !== -1 && !payload.line) {
    return json(400, { error: "This step needs a seed line." });
  }
  if ((mode === "expand" || mode === "recell") && !payload.dna) {
    return json(400, { error: "This step needs the locked DNA. Run the read first." });
  }

  const lang = payload.lang === "da" ? "da" : "en";
  const srcLang = payload.srcLang || "da";

  let res;
  try {
    res = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": API_VERSION,
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: MAX_TOKENS[mode] || 4000,
        system: systemPrompt(lang, srcLang),
        messages: [{ role: "user", content: build(payload) }],
      }),
    });
  } catch (err) {
    return json(502, {
      error: "Could not reach the Anthropic API. " + (err && err.message ? err.message : ""),
    });
  }

  if (!res.ok) {
    const detail = await res.text().catch(function () {
      return "";
    });

    if (res.status === 529) {
      return json(529, {
        error:
          "The API is overloaded right now. This is upstream, not a configuration " +
          "problem, and the key is fine. Wait a moment and run it again.",
      });
    }
    if (res.status === 401) {
      return json(401, {
        error: "The API rejected the key. Check ANTHROPIC_API_KEY on this Netlify site.",
      });
    }
    if (res.status === 400 && /model/i.test(detail)) {
      return json(400, {
        error:
          "The API rejected the model string. generate.js is currently set to " +
          MODEL + ". Check that this model is still current.",
      });
    }
    return json(res.status, { error: "API error " + res.status + ". " + detail.slice(0, 500) });
  }

  const data = await res.json();
  const text = (data.content || [])
    .filter(function (b) { return b.type === "text"; })
    .map(function (b) { return b.text; })
    .join("\n");

  return json(200, { mode: mode, lang: lang, model: MODEL, raw: text, usage: data.usage || null });
};
