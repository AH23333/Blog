const lightboxClass = "image-lightbox";
const openClass = "image-lightbox-open";

type LightboxElements = {
  dialog: HTMLDialogElement;
  image: HTMLImageElement;
  caption: HTMLElement;
  controls: HTMLElement;
  btnZoomIn: HTMLButtonElement;
  btnZoomOut: HTMLButtonElement;
  btnPrev: HTMLButtonElement;
  btnNext: HTMLButtonElement;
  btnClose: HTMLButtonElement;
  zoomLabel: HTMLElement;
};

type LightboxTransform = {
  scale: number;
  x: number;
  y: number;
};

type DragState = {
  pointerId: number;
  startX: number;
  startY: number;
  originX: number;
  originY: number;
  moved: boolean;
};

type TapState = {
  targetIsImage: boolean;
  moved: boolean;
};

type PinchState = {
  startDistance: number;
  startScale: number;
  startX: number;
  startY: number;
  centerX: number;
  centerY: number;
};

const minScale = 0.12;
const maxScale = 8;
const wheelZoomStep = 0.1; // 固定每次滚轮操作 10% 缩放
const buttonScaleStep = 0.25;
const dragSuppressDistance = 4;
const pinchSensitivity = 1.35;
const clickSuppressMs = 280;

let activeTrigger: HTMLElement | undefined;
let transform: LightboxTransform = { scale: 1, x: 0, y: 0 };
let dragState: DragState | undefined;
let pinchState: PinchState | undefined;
let tapState: TapState | undefined;
let suppressClickUntil = 0;
let boundLightbox: LightboxElements | undefined;
let allTriggers: HTMLElement[] = [];
let currentIndex = 0;

// ─── 安装 ─────────────────────────────────────────────────────────────

export function installImageLightbox(root: ParentNode = document): void {
  const triggers = root.querySelectorAll<HTMLElement>("[data-lightbox-image]");

  if (triggers.length === 0) {
    return;
  }

  allTriggers = Array.from(triggers);
  const lightbox = ensureLightbox();

  for (const trigger of triggers) {
    if (trigger.dataset.lightboxReady === "true") {
      continue;
    }

    trigger.dataset.lightboxReady = "true";
    trigger.addEventListener("click", () => {
      currentIndex = allTriggers.indexOf(trigger);
      openLightbox(trigger, lightbox);
    });
  }
}

// ─── DOM 创建 ──────────────────────────────────────────────────────────

function ensureLightbox(): LightboxElements {
  const existing = document.querySelector<HTMLDialogElement>(`.${lightboxClass}`);

  if (existing) {
    const lightbox = buildLightboxRefs(existing);
    boundLightbox = lightbox;
    return lightbox;
  }

  const dialog = document.createElement("dialog");
  dialog.className = lightboxClass;
  dialog.setAttribute("aria-label", "Image preview");
  dialog.tabIndex = -1;
  dialog.innerHTML = [
    '<figure class="image-lightbox-frame">',
    '<img class="image-lightbox-image" alt="" decoding="async" draggable="false" />',
    '<figcaption class="image-lightbox-caption"></figcaption>',
    "</figure>",
    // 控制栏
    '<div class="image-lightbox-controls">',
    '<div class="image-lightbox-controls-left">',
    '<button class="image-lightbox-btn" data-action="prev" title="上一张 (←)">◀</button>',
    '<button class="image-lightbox-btn" data-action="next" title="下一张 (→)">▶</button>',
    '<span class="image-lightbox-counter"></span>',
    "</div>",
    '<div class="image-lightbox-controls-center">',
    '<button class="image-lightbox-btn" data-action="zoom-out" title="缩小 (−)">−</button>',
    '<span class="image-lightbox-zoom-label">100%</span>',
    '<button class="image-lightbox-btn" data-action="zoom-in" title="放大 (+)">+</button>',
    "</div>",
    '<div class="image-lightbox-controls-right">',
    '<button class="image-lightbox-btn" data-action="close" title="关闭 (Esc)">✕</button>',
    "</div>",
    "</div>"
  ].join("");

  document.body.append(dialog);

  const lightbox = buildLightboxRefs(dialog);
  boundLightbox = lightbox;

  // 事件绑定
  document.addEventListener("click", suppressSyntheticClick, true);

  dialog.addEventListener("click", (event) => {
    if (Date.now() < suppressClickUntil) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }

    const target = event.target as HTMLElement;
    const action = target.closest<HTMLButtonElement>("[data-action]")?.dataset.action;

    if (action) {
      handleControlAction(action, lightbox);
      return;
    }

    if (event.target !== lightbox.image) {
      event.preventDefault();
      event.stopPropagation();
      closeLightbox(lightbox);
    }
  });

  dialog.addEventListener("wheel", (event) => zoomImage(event, lightbox), { passive: false });
  dialog.addEventListener("pointerdown", (event) => startPointerDrag(event, lightbox));
  dialog.addEventListener("pointermove", (event) => movePointerDrag(event, lightbox));
  dialog.addEventListener("pointerup", (event) => stopPointerDrag(event, lightbox));
  dialog.addEventListener("pointercancel", (event) => stopPointerDrag(event, lightbox));
  dialog.addEventListener("touchstart", (event) => startTouch(event, lightbox), { passive: false });
  dialog.addEventListener("touchmove", (event) => moveTouch(event, lightbox), { passive: false });
  dialog.addEventListener("touchend", (event) => stopTouch(event, lightbox), { passive: false });
  dialog.addEventListener("touchcancel", (event) => stopTouch(event, lightbox), { passive: false });
  dialog.addEventListener("cancel", () => resetLightbox());
  dialog.addEventListener("close", () => resetLightbox());

  document.addEventListener("keydown", (event) => handleKeyboard(event, lightbox));

  return lightbox;
}

function buildLightboxRefs(dialog: HTMLDialogElement): LightboxElements {
  return {
    dialog,
    image: requireElement(dialog, ".image-lightbox-image", HTMLImageElement),
    caption: requireElement(dialog, ".image-lightbox-caption", HTMLElement),
    controls: requireElement(dialog, ".image-lightbox-controls", HTMLElement),
    btnZoomIn: requireElement(dialog, '[data-action="zoom-in"]', HTMLButtonElement),
    btnZoomOut: requireElement(dialog, '[data-action="zoom-out"]', HTMLButtonElement),
    btnPrev: requireElement(dialog, '[data-action="prev"]', HTMLButtonElement),
    btnNext: requireElement(dialog, '[data-action="next"]', HTMLButtonElement),
    btnClose: requireElement(dialog, '[data-action="close"]', HTMLButtonElement),
    zoomLabel: requireElement(dialog, ".image-lightbox-zoom-label", HTMLElement)
  };
}

// ─── 控制动作 ──────────────────────────────────────────────────────────

function handleControlAction(action: string, lightbox: LightboxElements): void {
  switch (action) {
    case "zoom-in":
      zoomByStep(lightbox, buttonScaleStep);
      break;
    case "zoom-out":
      zoomByStep(lightbox, -buttonScaleStep);
      break;
    case "prev":
      navigateImage(lightbox, -1);
      break;
    case "next":
      navigateImage(lightbox, 1);
      break;
    case "close":
      closeLightbox(lightbox);
      break;
  }
}

function handleKeyboard(event: KeyboardEvent, lightbox: LightboxElements): void {
  if (!lightbox.dialog.open) {
    return;
  }

  switch (event.key) {
    case "Escape":
      closeLightbox(lightbox);
      break;
    case "ArrowLeft":
      event.preventDefault();
      navigateImage(lightbox, -1);
      break;
    case "ArrowRight":
      event.preventDefault();
      navigateImage(lightbox, 1);
      break;
    case "+":
    case "=":
      event.preventDefault();
      zoomByStep(lightbox, buttonScaleStep);
      break;
    case "-":
      event.preventDefault();
      zoomByStep(lightbox, -buttonScaleStep);
      break;
    case "0":
      event.preventDefault();
      resetZoom(lightbox);
      break;
  }
}

// ─── 缩放 ──────────────────────────────────────────────────────────────

function zoomByStep(lightbox: LightboxElements, delta: number): void {
  const nextScale = transform.scale * (1 + delta);
  // 按钮缩放以视口中心为锚点 → 图片在缩放过程中始终居中
  zoomToPoint(lightbox, window.innerWidth / 2, window.innerHeight / 2, nextScale);
  updateZoomLabel(lightbox);
}

function zoomToPoint(lightbox: LightboxElements, clientX: number, clientY: number, scale: number): void {
  const nextScale = clamp(scale, minScale, maxScale);

  if (nextScale === transform.scale) {
    return;
  }

  const vpCenterX = window.innerWidth / 2;
  const vpCenterY = window.innerHeight / 2;

  // 光标相对于图片视觉中心的偏移
  const dx = clientX - (vpCenterX + transform.x);
  const dy = clientY - (vpCenterY + transform.y);

  // 缩放比例
  const ratio = nextScale / transform.scale;

  // 调整偏移量使光标下的点保持静止
  transform = {
    scale: nextScale,
    x: transform.x + dx * (1 - ratio),
    y: transform.y + dy * (1 - ratio)
  };
  applyImageTransform(lightbox);
}

function resetZoom(lightbox: LightboxElements): void {
  transform = { scale: 1, x: 0, y: 0 };
  applyImageTransform(lightbox);
  updateZoomLabel(lightbox);
}

function updateZoomLabel(lightbox: LightboxElements): void {
  lightbox.zoomLabel.textContent = `${Math.round(transform.scale * 100)}%`;
}

// ─── 导航 ──────────────────────────────────────────────────────────────

function navigateImage(lightbox: LightboxElements, delta: number): void {
  if (allTriggers.length <= 1) {
    return;
  }

  currentIndex = (((currentIndex + delta) % allTriggers.length) + allTriggers.length) % allTriggers.length;
  const trigger = allTriggers[currentIndex];

  if (trigger) {
    openLightbox(trigger, lightbox);
  }
}

// ─── 打开 / 关闭 ───────────────────────────────────────────────────────

function openLightbox(trigger: HTMLElement, lightbox: LightboxElements): void {
  const source = trigger.querySelector<HTMLImageElement>("img");

  if (!source) {
    return;
  }

  activeTrigger = trigger;
  lightbox.image.src = source.currentSrc || source.src;
  lightbox.image.alt = source.alt;
  lightbox.caption.textContent = source.alt;
  lightbox.caption.hidden = source.alt.trim().length === 0;
  transform = { scale: 1, x: 0, y: 0 };
  applyImageTransform(lightbox);
  updateZoomLabel(lightbox);
  updateNavButtons(lightbox);

  document.body.classList.add(openClass);
  if (!lightbox.dialog.open) {
    lightbox.dialog.showModal();
  }
  lightbox.dialog.focus({ preventScroll: true });
}

function updateNavButtons(lightbox: LightboxElements): void {
  const counter = lightbox.controls.querySelector(".image-lightbox-counter");
  if (counter) {
    counter.textContent = allTriggers.length > 1 ? `${currentIndex + 1} / ${allTriggers.length}` : "";
  }
  lightbox.btnPrev.style.visibility = allTriggers.length > 1 ? "visible" : "hidden";
  lightbox.btnNext.style.visibility = allTriggers.length > 1 ? "visible" : "hidden";
}

function closeLightbox(lightbox: LightboxElements): void {
  resetLightbox();

  if (lightbox.dialog.open) {
    lightbox.dialog.close();
  }
}

function resetLightbox(): void {
  document.body.classList.remove(openClass);
  dragState = undefined;
  pinchState = undefined;
  tapState = undefined;
  suppressClickUntil = 0;
  lightboxImageClassList()?.remove("image-lightbox-image-dragging");
  activeTrigger?.focus({ preventScroll: true });
  activeTrigger = undefined;
}

// ─── 滚轮缩放 ──────────────────────────────────────────────────────────

function zoomImage(event: WheelEvent, lightbox: LightboxElements): void {
  event.preventDefault();
  // 仅使用 deltaY 符号判断方向，固定每次 10% 缩放，确保跨设备稳定
  const factor = 1 - Math.sign(event.deltaY) * wheelZoomStep;
  zoomToPoint(lightbox, event.clientX, event.clientY, transform.scale * factor);
  updateZoomLabel(lightbox);
}

// ─── 指针拖拽 ──────────────────────────────────────────────────────────

function startPointerDrag(event: PointerEvent, lightbox: LightboxElements): void {
  if (event.pointerType === "touch") {
    event.preventDefault();
    return;
  }

  if (event.target !== lightbox.image) {
    dragState = undefined;
    return;
  }

  event.preventDefault();
  capturePointer(lightbox.dialog, event.pointerId);

  dragState = {
    pointerId: event.pointerId,
    startX: event.clientX,
    startY: event.clientY,
    originX: transform.x,
    originY: transform.y,
    moved: false
  };
  lightbox.image.classList.add("image-lightbox-image-dragging");
}

function movePointerDrag(event: PointerEvent, lightbox: LightboxElements): void {
  if (event.pointerType === "touch") {
    event.preventDefault();
    return;
  }

  if (!dragState || event.pointerId !== dragState.pointerId) {
    return;
  }

  event.preventDefault();
  const dx = event.clientX - dragState.startX;
  const dy = event.clientY - dragState.startY;

  if (Math.hypot(dx, dy) > dragSuppressDistance) {
    dragState.moved = true;
    suppressClick();
  }

  transform = {
    ...transform,
    x: dragState.originX + dx,
    y: dragState.originY + dy
  };
  applyImageTransform(lightbox);
}

function stopPointerDrag(event: PointerEvent, lightbox: LightboxElements): void {
  if (event.pointerType === "touch") {
    event.preventDefault();
    return;
  }

  releasePointer(lightbox.dialog, event.pointerId);

  if (dragState?.moved) {
    suppressClick();
  }

  dragState = undefined;
  lightbox.image.classList.remove("image-lightbox-image-dragging");
}

// ─── 触摸处理 ──────────────────────────────────────────────────────────

function startTouch(event: TouchEvent, lightbox: LightboxElements): void {
  event.preventDefault();

  if (event.touches.length >= 2) {
    tapState = undefined;
    dragState = undefined;
    startTouchPinch(event, lightbox);
    return;
  }

  const touch = event.touches[0];

  if (!touch) {
    return;
  }

  const targetIsImage = event.target === lightbox.image;
  tapState = {
    targetIsImage,
    moved: false
  };

  if (!targetIsImage) {
    dragState = undefined;
    return;
  }

  dragState = {
    pointerId: touch.identifier,
    startX: touch.clientX,
    startY: touch.clientY,
    originX: transform.x,
    originY: transform.y,
    moved: false
  };
  lightbox.image.classList.add("image-lightbox-image-dragging");
}

function moveTouch(event: TouchEvent, lightbox: LightboxElements): void {
  event.preventDefault();

  if (event.touches.length >= 2) {
    tapState = undefined;

    if (!pinchState) {
      startTouchPinch(event, lightbox);
    }

    pinchImageFromMetrics(lightbox, touchMetrics(event));
    return;
  }

  const touch = event.touches[0];

  if (!touch || !dragState || touch.identifier !== dragState.pointerId) {
    return;
  }

  const dx = touch.clientX - dragState.startX;
  const dy = touch.clientY - dragState.startY;

  if (Math.hypot(dx, dy) > dragSuppressDistance) {
    dragState.moved = true;
    if (tapState) {
      tapState.moved = true;
    }
    suppressClick();
  }

  transform = {
    ...transform,
    x: dragState.originX + dx,
    y: dragState.originY + dy
  };
  applyImageTransform(lightbox);
}

function stopTouch(event: TouchEvent, lightbox: LightboxElements): void {
  event.preventDefault();

  if (pinchState) {
    suppressClick();
    pinchState = undefined;
  }

  if (event.touches.length >= 2) {
    startTouchPinch(event, lightbox);
    return;
  }

  if (event.touches.length === 1) {
    const touch = event.touches[0];
    dragState = {
      pointerId: touch.identifier,
      startX: touch.clientX,
      startY: touch.clientY,
      originX: transform.x,
      originY: transform.y,
      moved: false
    };
    return;
  }

  if (dragState?.moved) {
    suppressClick();
  }

  if (tapState && !tapState.targetIsImage && !tapState.moved) {
    suppressClick();
    closeLightbox(lightbox);
  }

  tapState = undefined;
  dragState = undefined;
  lightbox.image.classList.remove("image-lightbox-image-dragging");
}

// ─── 双指缩放 ──────────────────────────────────────────────────────────

function startTouchPinch(event: TouchEvent, lightbox: LightboxElements): void {
  const pinch = touchMetrics(event);

  if (!pinch) {
    return;
  }

  startPinchFromMetrics(lightbox, pinch);
}

function pinchImageFromMetrics(
  lightbox: LightboxElements,
  pinch: { distance: number; centerX: number; centerY: number } | undefined
): void {
  if (!pinchState || !pinch || pinchState.startDistance === 0) {
    return;
  }

  suppressClick();
  const distanceRatio = pinch.distance / pinchState.startDistance;
  const nextScale = clamp(pinchState.startScale * distanceRatio ** pinchSensitivity, minScale, maxScale);
  const vpCenterX = window.innerWidth / 2;
  const vpCenterY = window.innerHeight / 2;

  // 当前双指中心相对于初始图片视觉中心的偏移
  const dx = pinch.centerX - (vpCenterX + pinchState.startX);
  const dy = pinch.centerY - (vpCenterY + pinchState.startY);

  const ratio = nextScale / pinchState.startScale;

  transform = {
    scale: nextScale,
    x: pinchState.startX + dx * (1 - ratio),
    y: pinchState.startY + dy * (1 - ratio)
  };
  applyImageTransform(lightbox);
}

function startPinchFromMetrics(
  lightbox: LightboxElements,
  pinch: { distance: number; centerX: number; centerY: number }
): void {
  dragState = undefined;
  pinchState = {
    startDistance: pinch.distance,
    startScale: transform.scale,
    startX: transform.x,
    startY: transform.y,
    centerX: pinch.centerX,
    centerY: pinch.centerY
  };
  lightbox.image.classList.add("image-lightbox-image-dragging");
}

function touchMetrics(event: TouchEvent): { distance: number; centerX: number; centerY: number } | undefined {
  const left = event.touches.item(0);
  const right = event.touches.item(1);

  if (!left || !right) {
    return undefined;
  }

  const leftX = left.clientX;
  const leftY = left.clientY;
  const rightX = right.clientX;
  const rightY = right.clientY;
  const dx = rightX - leftX;
  const dy = rightY - leftY;

  return {
    distance: Math.hypot(dx, dy),
    centerX: (leftX + rightX) / 2,
    centerY: (leftY + rightY) / 2
  };
}

// ─── 变换应用 ──────────────────────────────────────────────────────────

function applyImageTransform(lightbox: LightboxElements): void {
  lightbox.image.style.transform = `translate(${roundTransform(transform.x)}px, ${roundTransform(transform.y)}px) scale(${roundTransform(transform.scale)})`;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function roundTransform(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function suppressClick(): void {
  suppressClickUntil = Date.now() + clickSuppressMs;
}

function suppressSyntheticClick(event: MouseEvent): void {
  if (Date.now() >= suppressClickUntil) {
    return;
  }

  event.preventDefault();
  event.stopPropagation();
}

function lightboxImageClassList(): DOMTokenList | undefined {
  return boundLightbox?.image.classList;
}

function capturePointer(element: HTMLElement, pointerId: number): void {
  try {
    element.setPointerCapture(pointerId);
  } catch {
    // Synthetic and older mobile pointer paths can reject capture
  }
}

function releasePointer(element: HTMLElement, pointerId: number): void {
  try {
    element.releasePointerCapture(pointerId);
  } catch {
    // Capture may already be gone
  }
}

function requireElement<T extends Element>(
  root: ParentNode,
  selector: string,
  elementType: new (...args: never[]) => T
): T {
  const element = root.querySelector(selector);

  if (!(element instanceof elementType)) {
    throw new Error(`Missing lightbox element: ${selector}`);
  }

  return element;
}
