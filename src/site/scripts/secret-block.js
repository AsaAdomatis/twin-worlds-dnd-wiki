(function () {
  "use strict";

  // NOTE: This is an honor-system lock, not real security — see the
  // comment in src/helpers/userSetup.js for details. The base64
  // content and password hash are both present in the page source
  // regardless of lock state.

  function base64ToUtf8(b64) {
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return new TextDecoder("utf-8").decode(bytes);
  }

  async function sha256Hex(text) {
    const enc = new TextEncoder().encode(text);
    const digest = await crypto.subtle.digest("SHA-256", enc);
    return Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }

  function reveal(block) {
    const contentB64 = block.getAttribute("data-secret-content") || "";
    const lockedEl = block.querySelector(".secret-block-locked");
    const contentEl = block.querySelector(".secret-block-content");

    contentEl.innerHTML = base64ToUtf8(contentB64);
    contentEl.hidden = false;
    lockedEl.hidden = true;
    block.classList.add("is-unlocked");
  }

  async function tryUnlock(block) {
    const input = block.querySelector(".secret-block-input");
    const errorEl = block.querySelector(".secret-block-error");
    const expectedHash = block.getAttribute("data-secret-hash") || "";
    const guess = (input.value || "").trim().toLowerCase();

    if (!guess) return;

    const guessHash = await sha256Hex(guess);
    if (guessHash === expectedHash) {
      reveal(block);
    } else {
      errorEl.hidden = false;
      block.classList.add("is-shaking");
      input.value = "";
      input.focus();
      setTimeout(() => block.classList.remove("is-shaking"), 400);
    }
  }

  function wireUpBlock(block) {
    if (block.dataset.secretBound) return;
    block.dataset.secretBound = "true";

    const mode = block.getAttribute("data-secret-mode");

    if (mode === "password") {
      const submitBtn = block.querySelector(".secret-block-submit");
      const input = block.querySelector(".secret-block-input");
      submitBtn.addEventListener("click", () => tryUnlock(block));
      input.addEventListener("keydown", (e) => {
        if (e.key === "Enter") tryUnlock(block);
      });
    } else {
      const revealBtn = block.querySelector(".secret-block-reveal");
      revealBtn.addEventListener("click", () => reveal(block));
    }
  }

  function wireUpAll() {
    document.querySelectorAll(".secret-block").forEach(wireUpBlock);
  }

  document.addEventListener("DOMContentLoaded", wireUpAll);
  window.addEventListener("load", wireUpAll);
  const observer = new MutationObserver(wireUpAll);
  observer.observe(document.body, { childList: true, subtree: true });
})();
