const crypto = require("crypto");

// ------------------------------------------------------------------
// "secret" marker block: hides content behind a password or a
// self-approved "reveal" button (e.g. for skill check gated lore).
//
// Unlike a fenced code block, this is just two HTML-comment markers
// wrapped around perfectly normal markdown. Obsidian natively hides
// HTML comments in Reading View, so the meta line (name/password/
// check) and the closing marker are invisible while you're just
// reading your notes -- and everything in between renders completely
// normally (headings, bold, [[wiki links]], embeds, etc.) both in
// Obsidian and on the published site, since it's real markdown text,
// not raw text sitting inside a code fence.
//
// NOTE: This is an honor-system lock, not real security. The site is
// fully static, so the (base64-obfuscated, already-rendered) content
// is shipped to every visitor's browser regardless of lock state.
// Anyone opening dev tools can decode data-secret-content directly.
// The raw password itself is never sent to the browser or embedded
// in the page anywhere -- only a SHA-256 hash of it is -- so casual
// "view source" won't reveal it, but this is still a spoiler guard
// for players playing fair, not a substitute for real access control.
//
// Usage in Obsidian notes:
//
// <!--secret
// name: Cult of Esitor Location
// password: donkey
// -->
// The secret content goes here, written completely normally --
// **bold**, [[wiki links]], lists, whatever you want.
// <!--endsecret-->
//
// <!--secret
// name: Old Ruins Basement
// check: Succeed on a DC 18 History check
// -->
// There's a hidden lever behind the altar...
// <!--endsecret-->
// ------------------------------------------------------------------

const SECRET_BLOCK_RE = /<!--\s*secret([\s\S]*?)-->([\s\S]*?)<!--\s*endsecret\s*-->/g;

// ------------------------------------------------------------------
// "private" marker block: completely removes content before the
// site is ever built, rather than gating it. Unlike "secret" blocks,
// nothing is shipped to the browser at all -- there is no hidden
// payload to decode in dev tools, because it never makes it into
// the rendered HTML in the first place.
//
// IMPORTANT CAVEAT: this only strips content from the *built site*.
// The raw text still lives in your Obsidian note and, once you
// commit/push, in your GitHub repo (including its history). If that
// repo is public, the private text is still technically visible
// there. For anything you don't want to leave your vault at all,
// prefer Obsidian's own native `%% ... %%` comment syntax instead --
// Digital Garden strips that *before* publishing, so it never
// reaches GitHub in the first place. Use `<!--private-->` here for
// content that's fine to sit in a private repo (or one you don't
// mind existing in git history) but should never appear on the
// live site.
//
// Usage in Obsidian notes:
//
// <!--private-->
// DM-only reminder, stat block draft, whatever -- never built into
// the site at all.
// <!--endprivate-->
// ------------------------------------------------------------------

const PRIVATE_BLOCK_RE = /<!--\s*private\s*-->[\s\S]*?<!--\s*endprivate\s*-->/g;

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, function (c) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
  });
}

function parseSecretMeta(rawMeta) {
  const meta = {};
  rawMeta.split("\n").forEach(function (line) {
    const m = line.match(/^\s*([\w-]+)\s*:\s*(.*?)\s*$/);
    if (m) {
      meta[m[1].trim().toLowerCase()] = m[2];
    }
  });
  return meta;
}

function renderSecretBlock(md, rawMeta, rawBody) {
  const meta = parseSecretMeta(rawMeta);

  const name = meta.name || "Hidden Content";
  const password = meta.password || "";
  const check = meta.check || "";
  const hasPassword = password.length > 0;

  // Render the body through the *same* markdown-it instance, so every
  // other plugin in the pipeline (wiki links, embeds, callouts, etc.)
  // still applies -- this is what makes links work on the site too.
  const renderedBody = md.render(rawBody.trim());
  const contentB64 = Buffer.from(renderedBody, "utf8").toString("base64");
  const passwordHash = hasPassword
    ? crypto.createHash("sha256").update(password.trim().toLowerCase()).digest("hex")
    : "";

  const mode = hasPassword ? "password" : "check";

  const unlockUi = hasPassword
    ? `<div class="secret-block-unlock-row">
        <input type="password" class="secret-block-input" placeholder="Enter password&hellip;" />
        <button type="button" class="secret-block-submit">Unlock</button>
      </div>
      ${check ? `<div class="secret-block-hint">${escapeHtml(check)}</div>` : ""}
      <div class="secret-block-error" hidden>Incorrect password.</div>`
    : `<div class="secret-block-check">${escapeHtml(check || "Reveal this content.")}</div>
       <button type="button" class="secret-block-reveal">I succeeded &mdash; reveal</button>`;

  return `\n<div class="secret-block" data-secret-mode="${mode}" data-secret-hash="${passwordHash}" data-secret-content="${contentB64}">
  <div class="secret-block-header">&#128274; ${escapeHtml(name)}</div>
  <div class="secret-block-locked">
    ${unlockUi}
  </div>
  <div class="secret-block-content" hidden></div>
</div>\n`;
}

function secretBlockCoreRule(state) {
  const md = state.md;
  if (state.src.indexOf("<!--secret") === -1) return;

  state.src = state.src.replace(SECRET_BLOCK_RE, function (match, rawMeta, rawBody) {
    return renderSecretBlock(md, rawMeta, rawBody);
  });
}

function privateBlockCoreRule(state) {
  if (state.src.indexOf("<!--private") === -1) return;

  // Replace with a single newline rather than an empty string, so
  // removing a block doesn't accidentally glue two unrelated
  // paragraphs together into one.
  state.src = state.src.replace(PRIVATE_BLOCK_RE, "\n");
}

function userMarkdownSetup(md) {
  // The md parameter stands for the markdown-it instance used throughout the site generator.
  // Feel free to add any plugin you want here instead of /.eleventy.js

  // Run right after source-normalization (CRLF -> LF etc.) and before
  // block tokenization, so we can safely rewrite raw source text.
  // Private stripping runs first so a stray "<!--private-->" can
  // never accidentally interact with secret-block parsing.
  md.core.ruler.after("normalize", "private_block", privateBlockCoreRule);
  md.core.ruler.after("normalize", "secret_block", secretBlockCoreRule);
}
function userEleventySetup(eleventyConfig) {
  // The eleventyConfig parameter stands for the the config instantiated in /.eleventy.js.
  // Feel free to add any plugin you want here instead of /.eleventy.js
}
exports.userMarkdownSetup = userMarkdownSetup;
exports.userEleventySetup = userEleventySetup;
