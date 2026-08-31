# DK Copy Studio

Landal copywriting tool for the Danish market. Third studio alongside UK Copy Studio
and NL Copy Studio. Same architecture, two new things.

---

## What is new here

**1. The expand flow.** The Danish team asked for the reverse direction: start with a
finished line and fold it out across platforms and audiences. That runs as a four step
flow.

    Seed  ->  Read  ->  Direct  ->  Refine

The Read step is the part that matters. Before anything is written, the tool diagnoses
the line and extracts a **message DNA**: one plain sentence naming the single idea. That
DNA is editable, then locked, then injected into every expansion prompt. Without it, a
line drifts into mush by the fifth adaptation. With it, every cell has to prove it still
carries the original idea, and says so in its own note.

The diagnosis also names what breaks when the line moves, which is usually wordplay that
will not survive a language change. The skill instructs the model to rebuild a new
mechanic on the same DNA rather than translate a pun, and to flag when it has done so.

**2. Client side guardrails.** The browser checks every generated cell after parsing
rather than trusting the prompt to remember: no em dash, no GreenParks, no exclamation
mark, no word bank hit, no character overrun. Deterministic and instant. Unbracketed
prices and dates get a warn flag rather than a fail, because sometimes they are real.

---

## Architecture

    index.html                      Frontend, single file
    netlify/functions/generate.js   Backend, four modes
    netlify/functions/skill-dk.js   GENERATED. Do not edit
    skill/landal-copy-skill-dk.md   Skill, source of truth
    scripts/sync-skill.js           Compiles the markdown into the JS module
    scripts/check-rules.js          Pre-commit rule check

### Why the skill is compiled

Netlify does not bundle files read with `fs.readFileSync` at runtime, which is how the
skill silently stopped loading in an earlier studio. The fix there was to inline the
skill as a template literal by hand, which then drifts every time the skill is edited.

Here the markdown stays readable and authoritative, and `sync-skill.js` compiles it into
`skill-dk.js`, a real JS module that the bundler follows through a normal `require`.
`netlify.toml` runs the sync on every build, so a forgotten sync cannot ship stale copy.
`check-rules.js` also fails if the two have drifted.

**If you edit the skill, run this before committing:**

    node scripts/sync-skill.js
    node scripts/check-rules.js

---

## Setup

1. Create the repo as `mlwrose/landal-dk-copy-studio` and push these files.
2. Create the Netlify site from that repo.
3. Set the environment variable, Site configuration, Environment variables:

       ANTHROPIC_API_KEY = [your key]

   Never commit the key. `check-rules.js` fails the build if one appears in the source.
4. Link the CLI by site ID, not by name:

       netlify link --id [dk-site-id]

5. Record the site ID in this README once it exists.

    Site ID: [TO BE ADDED]
    URL:     [TO BE ADDED]

---

## Modes on the API

| Mode | Sent when | Returns |
|---|---|---|
| `brief` | Brief mode, Write copy | Scored variants, `##VARIANT_START##` blocks |
| `diagnose` | Expand mode, Read the line | One `##DIAGNOSIS_START##` block |
| `expand` | Expand mode, Expand | One `##CELL_START##` block per combination |
| `recell` | Any cell, Regenerate | A single `##CELL_START##` block |

Brief mode keeps the `##VARIANT_START##` / `##SCORE:` / `##VARIANT_END##` delimiters used
by the other two studios so parsing stays consistent across all three. `##WHY:` is added
and is safe to ignore anywhere it is not wanted.

---

## Language toggle

The header switch controls output language only. The Danish skill is always loaded and
always does the brand thinking.

- **Dansk** is production output. Full Danish craft rules apply.
- **English** is debug output. The model is told to compose in Danish first, test it
  against the Danish rules, then render the equivalent in English. It is not a
  translation layer, and the output is not publication ready. The blue bar under the
  header is the reminder.

Flip to Dansk before anything is shown to the Danish team.

---

## Tuning platform limits

All character limits live in one place, the `SPECS` object at the top of the script block
in `index.html`. The frontend sends the relevant spec to the API with every request, so
there is nothing to keep in sync on the backend. Edit the numbers there and both the
prompt and the meters follow.

---

## Absolute rules

These are enforced in three places: the skill, the system prompt, and `check-rules.js`.

- No em dashes. Anywhere. Copy, skill, comments, notes.
- Landal. Never Landal GreenParks.
- No invented specifics. Bracketed placeholders instead: `[BELØB]`, `[DATO]`, `[PARKNAVN]`.
- The API key is an environment variable and nothing else.
- DK, UK and NL stay strictly separate. Do not share prompts, briefs or deploy targets.

---

## Danish parks

Landal Seawest, Landal Rønbjerg, Landal Søhøjlandet, Landal Ebeltoft,
Landal Grønhøj Strand, Landal Fyrklit.

Landal Middelfart appears on some older Landal Denmark listings but not on the current
six park count. Confirm with the Danish team before the skill references it.
