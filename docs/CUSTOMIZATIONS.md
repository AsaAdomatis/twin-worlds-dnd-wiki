# Custom Site Features

This file documents everything added on top of the base [Digital Garden](https://github.com/oleeskild/digitalgarden) template for this repo. All of it lives in the template's sanctioned "won't get clobbered by a template update" extension points:

- `src/helpers/userSetup.js` -- the `userMarkdownSetup(md)` hook, for extending the markdown-it pipeline
- `src/site/styles/user/` -- auto-loaded custom CSS/SCSS
- `src/site/scripts/` -- auto-copied static JS, loaded via components
- `src/site/_includes/components/user/<namespace>/<slot>/` -- custom component slots injected into every page

None of this required forking or modifying the Digital Garden Obsidian plugin itself -- it's all repo/site-generator side.

---

## 1. Handwritten black & white theme

**Files:**
- `src/site/styles/user/handwritten-bw.scss`

**What it does:** Overrides the site's base Obsidian CSS variables (colors, fonts) and the Digital-Garden-specific layout variables to produce a grayscale palette with handwritten fonts (Patrick Hand for body, Caveat for headings, both from Google Fonts, with Comic Sans MS as a literal fallback). Also gives callouts/tables/code blocks/images "hand-drawn" uneven borders and offset drop-shadows, and forces the graph view to grayscale too.

**To customize further:** edit the CSS variables at the top of the file, or the font stack in `--font-text` / `--heading-font`.

---

## 2. Image pan/zoom lightbox

**Files:**
- `src/site/scripts/image-zoom.js` -- click-to-open, scroll-to-zoom, drag-to-pan lightbox logic (vanilla JS, no external dependencies, basic touch/pinch support included)
- `src/site/styles/user/image-zoom.scss` -- overlay styling, matches the B&W handwritten theme
- `src/site/_includes/components/user/common/afterContent/image-zoom.njk` -- loads the script on every page

**What it does:** Any image inside note content becomes clickable. Clicking opens a full-screen overlay where you can scroll to zoom (1x-8x), drag to pan, double-click to reset, and Esc/click-outside/× to close.

**Note:** there's no setting for this in the Digital Garden plugin itself -- it's a fully custom addition, since image pan/zoom on the *published* site isn't something the plugin exposes (Obsidian-editor image plugins like Image Toolkit only affect the Obsidian app, not the deployed site).

---

## 3. `secret` blocks -- password / skill-check gated content

**Files:**
- `src/helpers/userSetup.js` -- `secretBlockCoreRule`, `renderSecretBlock`, `parseSecretMeta`, registered via `md.core.ruler.after("normalize", "secret_block", secretBlockCoreRule)`
- `src/helpers/anchorUtils.js` -- shared `getAnchorLink`/`getAnchorAttributes`/`resolveWikiLinks` helpers (also used by `.eleventy.js` itself for the main `link` filter, so wiki-link resolution can't drift out of sync between the two)
- `src/site/scripts/secret-block.js` -- client-side unlock logic (SHA-256 password check via Web Crypto, or a simple reveal button)
- `src/site/styles/user/secret-block.scss` -- locked/unlocked styling, matches the B&W handwritten theme
- `src/site/_includes/components/user/common/afterContent/secret-block.njk` -- loads the script on every page

### Syntax (in Obsidian notes)

Password-gated:
```
<!--secret
name: Cult of Esitor Location
password: donkey
-->
The secret content goes here, written completely normally --
**bold**, [[wiki links]], lists, whatever you want.
<!--endsecret-->
```

Self-approved (e.g. skill check):
```
<!--secret
name: Old Ruins Basement
check: Succeed on a DC 18 History check
-->
There's a hidden lever behind the altar...
<!--endsecret-->
```

If both `password` and `check` are given, the check text is shown as a hint above the password field.

### How it works

The markers are HTML comments (`<!--secret ... -->` / `<!--endsecret-->`), not a code fence. This matters for two reasons:

1. **Obsidian hides HTML comments in Reading View** -- so the meta line (name/password/check) and the closing marker are simply invisible while reading your own notes. The content between the markers is ordinary, unwrapped markdown, so it displays exactly like the rest of your vault.
2. **The content is real markdown, not raw fenced text** -- a `secretBlockCoreRule` runs as a markdown-it *core rule*, early in the pipeline (right after source normalization, before block tokenization). It regex-matches `<!--secret...--> body <!--endsecret-->` spans in the raw source and replaces each one with pre-rendered HTML, calling `md.render(body)` using the *same* markdown-it instance -- so every other plugin already configured (embeds, callouts, etc.) still applies to the body.

The rendered HTML for the body is base64-encoded and stored in a `data-secret-content` attribute on a locked `<div>`. The password (if any) is **never** embedded in the page -- only its SHA-256 hash is (`data-secret-hash`). `secret-block.js` wires up click/submit handlers: for password mode, it hashes the visitor's input client-side (via `crypto.subtle.digest`) and compares hex digests; on match, it base64-decodes and injects the stored HTML. For check-mode, a plain "reveal" button does the same without any password check.

#### Wiki-links inside secret blocks

`[[Target|Title]]` links are **not** resolved by markdown-it at all in this codebase -- they pass through markdown rendering as plain literal text. The actual conversion to a real `<a>` tag happens afterward, via a Nunjucks template filter (`link`, defined in `.eleventy.js`) that regex-replaces `[[...]]` patterns across the *whole rendered page*, once, after all markdown rendering is done.

That's a problem for secret blocks specifically: their rendered body gets base64-encoded and tucked into a `data-secret-content` attribute *before* that page-level filter ever runs, so by the time the filter scans the page, the literal `[[...]]` text is hidden inside an encoded attribute and never gets converted -- it would otherwise show up literally as `[[Target|Title]]` once decoded and revealed.

The fix: `renderSecretBlock` calls `resolveWikiLinks()` (from `anchorUtils.js` -- the exact same logic as the `link` filter, extracted so both places share one implementation) directly on the rendered body, before base64-encoding it. So links are already fully resolved to real `<a>` tags by the time they're encoded, and just work once revealed.

Note this same underlying issue (page-level filters running after this content is already encoded) would also apply to the `taggify` (`#hashtag`) filter and `hideDataview` filter if you ever use those inside a secret block -- they aren't currently wired up the same way `resolveWikiLinks` is, so hashtags/dataview syntax inside a secret block won't be converted. Not fixed here since it wasn't reported as an issue, but the fix would follow the identical pattern if needed later.

### Security model -- read before relying on this for real secrets

This is an **honor-system spoiler guard, not real security**. The site is fully static (no backend), so the locked content -- base64-encoded, but not encrypted -- ships to every visitor's browser regardless of lock state. Anyone who opens browser dev tools can find and decode `data-secret-content` directly, bypassing the password entirely. It's good for "don't spoil yourself by scrolling past" or "click when your character actually succeeds the check," assuming players are acting in good faith. It is not a substitute for real access control.

If real access control is ever needed (content that must not be retrievable even by a technical, curious player), that requires a fundamentally different design -- e.g. a Vercel serverless function that only serves content after a correct *server-side* password check, so the secret content is never sent to the browser until authorized. That's a substantially bigger addition (API route, restructuring how secret content is built/stored) and hasn't been built here.

---

## 4. `private` blocks -- fully removed from the build

**Files:**
- `src/helpers/userSetup.js` -- `privateBlockCoreRule`, registered via `md.core.ruler.after("normalize", "private_block", privateBlockCoreRule)`

### Syntax (in Obsidian notes)

```
<!--private-->
DM-only reminder, stat block draft, whatever -- never built into the site at all.
<!--endprivate-->
```

### How it works

A markdown-it core rule (same mechanism as `secret` blocks) regex-matches `<!--private--> ... <!--endprivate-->` spans in the raw source and deletes them outright (replaced with a single newline, so removing a block doesn't accidentally merge two unrelated paragraphs together) before any HTML is ever generated. Unlike `secret` blocks, there is no hidden payload shipped to the browser at all -- the content simply doesn't exist in the built site.

### Two-layer privacy model -- which one to use

| Marker | Where it's stripped | Ever touches GitHub? |
|---|---|---|
| Obsidian's native `%%your text%%` | Inside Obsidian, by the Digital Garden plugin, *before* publishing | **No** |
| `<!--private-->...<!--endprivate-->` | At site-build time, in this repo | **Yes** -- sits in the committed `.md` file and git history, just never rendered into the site |

**Use `%% %%`** for anything you'd be upset to see if someone browsed the GitHub repo's source or history directly (e.g. if the repo is public).

**Use `<!--private-->...<!--endprivate-->`** when you're fine with it existing in the repo/history but want it clearly marked and guaranteed to never appear on the live site -- e.g. scratch content, draft stat blocks, session-prep reminders that aren't really "secret lore," just not player-facing.

---

## File manifest

| File | Feature |
|---|---|
| `src/site/styles/user/handwritten-bw.scss` | Theme |
| `src/site/scripts/image-zoom.js` | Image zoom |
| `src/site/styles/user/image-zoom.scss` | Image zoom |
| `src/site/_includes/components/user/common/afterContent/image-zoom.njk` | Image zoom |
| `src/site/scripts/secret-block.js` | Secret blocks |
| `src/site/styles/user/secret-block.scss` | Secret blocks |
| `src/site/_includes/components/user/common/afterContent/secret-block.njk` | Secret blocks |
| `src/helpers/userSetup.js` | Secret blocks + Private blocks (markdown-it core rules) |
| `src/helpers/anchorUtils.js` | Shared wiki-link resolution (used by Secret blocks and by `.eleventy.js`'s main `link` filter) |
