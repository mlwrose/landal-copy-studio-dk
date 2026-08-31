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

    public/index.html               Frontend. This is the entire publish directory
    netlify/functions/generate.js   Backend. Self contained, skill inlined
    skill/landal-copy-skill-dk.md   Skill, readable source of truth
    scripts/sync-skill.js           Injects the markdown into generate.js
    scripts/check-rules.js          Rule and drift check
    scripts/preflight.sh            Run this before every push

### Why the frontend lives in public/

Netlify requires the functions directory to sit outside the publish directory. An earlier
version of this repo used `publish = "."`, which put `netlify/functions` inside the
published root. Two things went wrong as a result: the function was never deployed, and
the repo source was served as static files, so the Danish skill was downloadable from the
live site.

The frontend therefore lives in `public/` and that is the whole publish directory.
Nothing else is served. `preflight.sh` fails if the two directories ever overlap again.

Only the first two files are needed at runtime. Everything under `scripts/` and
`skill/` is a development convenience: if it went missing the deployed site would
still work, it would just be harder to edit the skill safely.

### Why the skill is inlined

Netlify does not bundle files read with `fs.readFileSync` at runtime, which is how the
skill silently stopped loading in an earlier studio.

An earlier version of this repo solved that by generating a separate `skill-dk.js`
module and requiring it. That was a mistake. It meant the function depended on a second
file being present at an exact path, and when the folder structure did not survive an
upload the function either vanished or crashed on startup with an empty response body,
which is very hard to diagnose from the browser.

So the skill is now inlined directly into `generate.js` as a template literal, the same
way UK Copy Studio and NL Copy Studio do it. The function has no local requires and no
siblings. The only thing Netlify needs is `netlify/functions/generate.js`.

The markdown stays the readable source of truth. `sync-skill.js` injects it into the
`SKILL START` / `SKILL END` block in place, and `check-rules.js` fails if the two have
drifted, so the usual cost of inlining is covered.

**If you edit the skill, run this before committing:**

    node scripts/sync-skill.js
    node scripts/check-rules.js

Then commit both the markdown and `generate.js`.

### Before every push

    ./scripts/preflight.sh

It checks the two required files are at the right paths, that nothing has been flattened
to the root, that the function has no sibling requires, that the skill block is filled in
and long enough, that the build command is pinned, and that nothing has drifted. It exits
non zero on failure.

### Health check

Once deployed, open the function URL in a browser:

    https://[site].netlify.app/.netlify/functions/generate

A GET returns whether the skill loaded, how long it is, and whether the API key is set.
No secrets, only booleans. That answers most deploy questions in one request.

## Setup

1. Push these files to `mlwrose/landal-copy-studio-dk`, keeping the folder structure.
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
