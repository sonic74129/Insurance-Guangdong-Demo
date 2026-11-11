(function initGuideWindow(global) {
  "use strict";
  const panel = document.getElementById("guidePanel");
  const body = document.getElementById("guideContent");
  const header = panel.querySelector(".guide-header");
  const launcher = document.querySelector(".guide-launcher");
  const preferenceKey = "anezx-guide-window-preferences-v1";
  const readingKey = "anezx-guide-reading-v1";
  const wideLayout = global.matchMedia("(min-width: 1180px)");
  const reading = { scroll: 0, chapters: new Map(), step: "开始阅读" };
  let geometry = null;
  let expanded = false;
  let restoreGeometry = null;
  let gesture = null;

  function defaults() {
    const width = Math.min(520, global.innerWidth - 24);
    const height = Math.min(Math.round(global.innerHeight * .76), global.innerHeight - 24);
    return { width, height, x: global.innerWidth - width - 12, y: global.innerHeight - height - 12 };
  }
  function clamp(value) {
    const width = Math.max(Math.min(300, global.innerWidth - 24), Math.min(value.width, global.innerWidth - 24));
    const height = Math.max(Math.min(220, global.innerHeight - 24), Math.min(value.height, global.innerHeight - 24));
    return { width, height, x: Math.max(12, Math.min(value.x, global.innerWidth - width - 12)), y: Math.max(12, Math.min(value.y, global.innerHeight - height - 12)) };
  }
  function apply() {
    if (!wideLayout.matches) return;
    geometry = clamp(geometry || defaults());
    Object.assign(panel.style, { width: `${geometry.width}px`, height: `${geometry.height}px`, left: `${geometry.x}px`, top: `${geometry.y}px` });
  }
  function persist() {
    if (!wideLayout.matches) return;
    try { global.localStorage.setItem(preferenceKey, JSON.stringify(geometry)); }
    catch (error) { console.warn("说明窗口偏好未保存。", error); }
  }
  try {
    const saved = JSON.parse(global.localStorage.getItem(preferenceKey) || "null");
    if (saved && ["width", "height", "x", "y"].every(key => Number.isFinite(saved[key]))) geometry = saved;
  } catch (error) { console.warn("无法读取说明窗口偏好。", error); }
  try {
    const saved = JSON.parse(global.localStorage.getItem(readingKey) || "null");
    if (saved?.version === 1 && Array.isArray(saved.chapters)) {
      reading.scroll = Number.isFinite(saved.scroll) ? Math.max(0, saved.scroll) : 0;
      reading.chapters = new Map(saved.chapters.map(([key, open]) => [global.AZXDemoGuide.chapterIds[key] || key, Boolean(open)]));
      reading.step = typeof saved.step === "string" ? saved.step : reading.step;
    }
  } catch (error) { console.warn("无法读取说明阅读位置；未覆盖原记录。", error); }

  function persistReading() {
    try { global.localStorage.setItem(readingKey, JSON.stringify({ version: 1, scroll: reading.scroll, chapters: [...reading.chapters], step: reading.step })); }
    catch (error) { console.warn("说明阅读位置未保存。", error); }
  }

  function setStep(text) {
    reading.step = text;
    launcher.querySelector(".guide-current-step").textContent = text;
    persistReading();
  }
  function capture() {
    if (panel.hidden) return;
    reading.scroll = body.scrollTop;
    body.querySelectorAll(".guide-chapter").forEach(chapter => reading.chapters.set(chapter.dataset.guideChapter, chapter.open));
    persistReading();
  }
  function restore() {
    body.querySelectorAll(".guide-chapter").forEach(chapter => {
      const key = chapter.dataset.guideChapter;
      if (reading.chapters.has(key)) chapter.open = reading.chapters.get(key);
    });
    apply();
    body.scrollTop = reading.scroll;
    const oldStepId = global.AZXDemoGuide.chapterIds[reading.step];
    const current = [...body.querySelectorAll(".guide-chapter")].find(chapter => chapter.dataset.guideChapter === oldStepId);
    if (current) setStep(current.querySelector("summary").textContent);
  }
  body.addEventListener("toggle", event => {
    if (!event.target.matches(".guide-chapter")) return;
    const text = event.target.querySelector("summary").textContent;
    reading.chapters.set(event.target.dataset.guideChapter, event.target.open);
  }, true);
  body.addEventListener("click", event => {
    const read = event.target.closest("[data-guide-read]");
    if (read) {
      const chapter = [...body.querySelectorAll(".guide-chapter")].find(item => item.dataset.guideChapter === read.dataset.guideRead);
      chapter.open = true;
      body.scrollTop += chapter.getBoundingClientRect().top - body.getBoundingClientRect().top;
      setStep(chapter.querySelector("summary").textContent);
      capture();
      return;
    }
    const summary = event.target.closest(".guide-chapter > summary");
    if (summary) setStep(summary.textContent);
    const button = event.target.closest("[data-guide-nav], [data-nav]");
    if (button) setStep(button.closest(".guide-chapter")?.querySelector("summary").textContent || button.textContent.trim());
  });
  function changeSize() {
    if (!expanded) restoreGeometry = { ...geometry };
    expanded = !expanded;
    geometry = expanded
      ? { width: global.innerWidth - 24, height: global.innerHeight - 24, x: 12, y: 12 }
      : clamp(restoreGeometry);
    updateControls();
    apply();
    persist();
  }
  function updateControls() {
    const button = panel.querySelector("[data-guide-size]");
    button.textContent = expanded ? "❐" : "□";
    button.title = expanded ? "还原到最大化前的大小和位置" : "最大化";
    button.setAttribute("aria-label", expanded ? "还原说明窗口" : "最大化说明窗口");
    panel.classList.toggle("guide-maximized", expanded);
  }
  panel.querySelector("[data-guide-size]").addEventListener("click", changeSize);
  panel.querySelector("[data-guide-default]").addEventListener("click", () => {
    expanded = false;
    restoreGeometry = null;
    geometry = defaults();
    updateControls();
    apply();
    persist();
  });

  header.tabIndex = 0;
  header.setAttribute("aria-label", "移动说明窗口：使用方向键");
  function start(event) {
    if (!wideLayout.matches) return;
    if (expanded || event.button !== 0 || event.target.closest("[data-action], [data-guide-size], [data-guide-default]")) return;
    const handle = event.target.closest("[data-guide-resize]");
    if (!handle && !event.target.closest(".guide-header")) return;
    event.preventDefault();
    const control = handle || header;
    control.setPointerCapture(event.pointerId);
    gesture = { id: event.pointerId, x: event.clientX, y: event.clientY, base: { ...geometry }, edge: handle?.dataset.guideResize || "", control };
  }
  function move(event) {
    if (!gesture || event.pointerId !== gesture.id) return;
    const dx = event.clientX - gesture.x, dy = event.clientY - gesture.y;
    const next = { ...gesture.base };
    const edge = gesture.edge;
    if (!edge) { next.x += dx; next.y += dy; }
    else {
      if (edge.includes("e")) next.width += dx;
      if (edge.includes("s")) next.height += dy;
      if (edge.includes("w")) { next.x += dx; next.width -= dx; }
      if (edge.includes("n")) { next.y += dy; next.height -= dy; }
    }
    geometry = next;
    apply();
  }
  function finish(event) {
    if (!gesture || event.pointerId !== gesture.id) return;
    if (event.type === "pointercancel") geometry = gesture.base;
    gesture = null;
    apply();
    persist();
  }
  panel.addEventListener("pointerdown", start);
  panel.addEventListener("pointermove", move);
  panel.addEventListener("pointerup", finish);
  panel.addEventListener("pointercancel", finish);
  panel.addEventListener("keydown", event => {
    if (!wideLayout.matches) return;
    if (expanded) return;
    const handle = event.target.closest("[data-guide-resize]");
    if (event.target !== header && !handle) return;
    if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) return;
    event.preventDefault();
    const delta = event.shiftKey ? 40 : 10;
    const dx = event.key === "ArrowLeft" ? -delta : event.key === "ArrowRight" ? delta : 0;
    const dy = event.key === "ArrowUp" ? -delta : event.key === "ArrowDown" ? delta : 0;
    if (handle) {
      const edge = handle.dataset.guideResize;
      if (edge.includes("e")) geometry.width += dx;
      if (edge.includes("s")) geometry.height += dy;
      if (edge.includes("w")) { geometry.width -= dx; geometry.x += dx; }
      if (edge.includes("n")) { geometry.height -= dy; geometry.y += dy; }
    } else { geometry.x += dx; geometry.y += dy; }
    apply();
    persist();
  });
  global.addEventListener("resize", () => {
    if (!wideLayout.matches) return;
    if (restoreGeometry) restoreGeometry = clamp(restoreGeometry);
    if (expanded) geometry = { width: global.innerWidth - 24, height: global.innerHeight - 24, x: 12, y: 12 };
    apply();
  });
  setStep(reading.step);
  apply();
  global.AZXGuideWindow = { capture, restore };
})(globalThis);
