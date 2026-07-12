const crypto = require("crypto");

// ------------------------------------------------------------------
// "secret" fenced block: hides content behind a password or a
// self-approved "reveal" button (e.g. for skill check gated lore).
//
// NOTE: This is an honor-system lock, not real security. The site is
// fully static, so the (base64-obfuscated) content is shipped to
// every visitor's browser regardless of lock state. Anyone opening
// dev tools can read data-secret-content directly. Good for
// spoiler-blocking players who are playing fair; not a substitute
// for actual access control.
//
// Usage in Obsidian notes:
//
// ```secret
// name: Cult of Esitor Location
// password: donkey
// ---
// The secret content goes here, in **markdown**.
// ```
//
// ```secret
// name: Old Ruins Basement
// check: Succeed on a DC 18 History check
// ---
// There's a hidden lever behind the altar...
// ```
// ------------------------------------------------------------------

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, function (c) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
  });
}

function parseSecretFence(raw) {
  const lines = raw.split("\n");
  let sepLineIndex = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim() === "---") {
      sepLineIndex = i;
      break;
    }
  }

  let headerLines, bodyLines;
  if (sepLineIndex === -1) {
    headerLines = [];
    bodyLines = lines;
  } else {
    headerLines = lines.slice(0, sepLineIndex);
    bodyLines = lines.slice(sepLineIndex + 1);
  }

  const meta = {};
  headerLines.forEach(function (line) {
    const m = line.match(/^\s*([\w-]+)\s*:\s*(.*)$/);
    if (m) {
      meta[m[1].trim().toLowerCase()] = m[2].trim();
    }
  });

  return { meta: meta, body: bodyLines.join("\n") };
}

function renderSecretBlock(md, rawContent) {
  const parsed = parseSecretFence(rawContent);
  const meta = parsed.meta;
  const body = parsed.body;

  const name = meta.name || "Hidden Content";
  const password = meta.password || "";
  const check = meta.check || "";
  const hasPassword = password.length > 0;

  const renderedBody = md.render(body);
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

  return `<div class="secret-block" data-secret-mode="${mode}" data-secret-hash="${passwordHash}" data-secret-content="${contentB64}">
  <div class="secret-block-header">&#128274; ${escapeHtml(name)}</div>
  <div class="secret-block-locked">
    ${unlockUi}
  </div>
  <div class="secret-block-content" hidden></div>
</div>`;
}

function userMarkdownSetup(md) {
  // The md parameter stands for the markdown-it instance used throughout the site generator.
  // Feel free to add any plugin you want here instead of /.eleventy.js

  const origFenceRule =
    md.renderer.rules.fence ||
    function (tokens, idx, options, env, self) {
      return self.renderToken(tokens, idx, options, env, self);
    };

  md.renderer.rules.fence = function (tokens, idx, options, env, self) {
    const token = tokens[idx];
    if (token.info && token.info.trim() === "secret") {
      return renderSecretBlock(md, token.content);
    }
    return origFenceRule(tokens, idx, options, env, self);
  };
}
function userEleventySetup(eleventyConfig) {
  // The eleventyConfig parameter stands for the the config instantiated in /.eleventy.js.
  // Feel free to add any plugin you want here instead of /.eleventy.js
}
exports.userMarkdownSetup = userMarkdownSetup;
exports.userEleventySetup = userEleventySetup;
