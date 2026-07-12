(function () {
  "use strict";

  // Only run once, and only wire up images inside the actual note content
  // (avoids grabbing logo/avatar/icon images in the header or sidebar).
  const CONTENT_SELECTOR = ".markdown-preview-view img, .content img, article img";

  let overlay, imgEl, scale, originX, originY, isPanning, panStartX, panStartY;

  function buildOverlay() {
    overlay = document.createElement("div");
    overlay.id = "dg-image-zoom-overlay";
    overlay.innerHTML = `
      <button id="dg-image-zoom-close" aria-label="Close image viewer">&times;</button>
      <div id="dg-image-zoom-hint">scroll to zoom &middot; drag to pan &middot; double-click to reset</div>
      <img id="dg-image-zoom-img" alt="" />
    `;
    document.body.appendChild(overlay);
    imgEl = overlay.querySelector("#dg-image-zoom-img");

    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) closeViewer();
    });
    overlay.querySelector("#dg-image-zoom-close").addEventListener("click", closeViewer);

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && overlay.classList.contains("is-open")) closeViewer();
    });

    imgEl.addEventListener("wheel", onWheel, { passive: false });
    imgEl.addEventListener("mousedown", onPanStart);
    imgEl.addEventListener("dblclick", resetTransform);
    window.addEventListener("mousemove", onPanMove);
    window.addEventListener("mouseup", onPanEnd);

    // Basic touch support: pinch zoom + drag
    let lastTouchDist = null;
    imgEl.addEventListener(
      "touchstart",
      (e) => {
        if (e.touches.length === 1) {
          isPanning = true;
          panStartX = e.touches[0].clientX - originX;
          panStartY = e.touches[0].clientY - originY;
        } else if (e.touches.length === 2) {
          lastTouchDist = touchDist(e.touches);
        }
      },
      { passive: true }
    );
    imgEl.addEventListener(
      "touchmove",
      (e) => {
        if (e.touches.length === 1 && isPanning) {
          originX = e.touches[0].clientX - panStartX;
          originY = e.touches[0].clientY - panStartY;
          applyTransform();
        } else if (e.touches.length === 2 && lastTouchDist) {
          const dist = touchDist(e.touches);
          scale = clamp(scale * (dist / lastTouchDist), 1, 8);
          lastTouchDist = dist;
          applyTransform();
        }
      },
      { passive: true }
    );
    imgEl.addEventListener("touchend", () => {
      isPanning = false;
      lastTouchDist = null;
    });
  }

  function touchDist(touches) {
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }

  function clamp(v, min, max) {
    return Math.max(min, Math.min(max, v));
  }

  function resetTransform() {
    scale = 1;
    originX = 0;
    originY = 0;
    applyTransform();
  }

  function applyTransform() {
    imgEl.style.transform = `translate(${originX}px, ${originY}px) scale(${scale})`;
    imgEl.style.cursor = scale > 1 ? "grab" : "zoom-in";
  }

  function onWheel(e) {
    e.preventDefault();
    const delta = -e.deltaY * 0.0015;
    scale = clamp(scale + delta, 1, 8);
    applyTransform();
  }

  function onPanStart(e) {
    if (scale <= 1) return;
    isPanning = true;
    panStartX = e.clientX - originX;
    panStartY = e.clientY - originY;
    imgEl.style.cursor = "grabbing";
  }

  function onPanMove(e) {
    if (!isPanning) return;
    originX = e.clientX - panStartX;
    originY = e.clientY - panStartY;
    applyTransform();
  }

  function onPanEnd() {
    isPanning = false;
    if (imgEl) imgEl.style.cursor = scale > 1 ? "grab" : "zoom-in";
  }

  function openViewer(src, alt) {
    if (!overlay) buildOverlay();
    imgEl.src = src;
    imgEl.alt = alt || "";
    resetTransform();
    overlay.classList.add("is-open");
    document.body.style.overflow = "hidden";
  }

  function closeViewer() {
    overlay.classList.remove("is-open");
    document.body.style.overflow = "";
  }

  function wireUpImages() {
    document.querySelectorAll(CONTENT_SELECTOR).forEach((img) => {
      if (img.dataset.dgZoomBound) return;
      img.dataset.dgZoomBound = "true";
      img.style.cursor = "zoom-in";
      img.addEventListener("click", () => openViewer(img.currentSrc || img.src, img.alt));
    });
  }

  // The garden is a static multi-page site; re-run after navigation
  // in case content is swapped in without a full page reload.
  document.addEventListener("DOMContentLoaded", wireUpImages);
  window.addEventListener("load", wireUpImages);
  const observer = new MutationObserver(wireUpImages);
  observer.observe(document.body, { childList: true, subtree: true });
})();