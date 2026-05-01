# Kahakai

One-page marketing site for kahakai — Jamey Warren's premium Shopify theme specialist practice in Livingston, MT. Live at kahak.ai.

## Stack

- Single static `index.html` with inline `<style>`. No build step, no JS framework.
- GitHub Pages deploy. Custom domain via `CNAME` (kahak.ai).
- Fonts via Google Fonts: Fraunces (serif), Geist (sans), Geist Mono.
- Two image assets in root: `Jamey.jpg` (source portrait), `jamey-duotone.jpg` (navy→cream duotone used in hero and meet sections).

## Voice

- Jamey runs this solo; collaborators are on call, not staff.
- Pattern in the existing copy: **"we"** when describing the work (sales/process), **"I"** when describing Jamey (credentials/personal). Keep that split — don't blend them.
- Positioning: senior specialist whose résumé is Out of the Sandbox (2014–17) → Archetype (2017–22) → Maestrooo (2022–now). The wedge is the support gap after a premium theme gets customized.
- Tone: confident, plain, dry. Field notes over marketing copy. Avoid agency-speak ("solutions," "partners," "transform").
- Phrase to preserve verbatim: **"sorry, that's outside support"** — used in the problem section and echoed in the pull quote. The repetition is the point.

## Design tokens

In `:root` on `index.html`:

- Background: `--ink` `#0a1824`, with `--ink-deep` `#06101a` for the pull-quote backdrop.
- Foreground: `--paper` `#ede6d6`, with `-soft` / `-quiet` / `-faint` / `-line` opacity steps.
- Accent: `--copper` `#c8663a`, `--copper-soft` `#d98456`. Italic copper `<em>` inside headlines is the standard emphasis pattern.

## Section order

nav · hero · problem · themes · case-study · process · pullquote · services · testimonials · meet · closer · foot

## Working norms

- Develop on feature branches. Don't push to `main` without an explicit ask.
- I can't preview the rendered page from this sandbox. Flag visual changes as un-previewed and let Jamey eyeball on his laptop before merging.
- For copy: propose first, edit second. Trim usually beats expand.
