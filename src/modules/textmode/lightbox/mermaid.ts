/**
 * Mermaid 图表 Lightbox 模块。
 *
 * 点击已渲染的 Mermaid 图表（<pre class="mermaid"> 内的 SVG）时，
 * 在全屏 Dialog 中展示可缩放、可拖拽的图表预览。
 *
 * 功能：
 * - 鼠标滚轮缩放（以光标位置为锚点）
 * - 双击放大 / 还原
 * - 按钮控制：放大、缩小、重置
 * - 拖拽平移（缩放后）
 * - 键盘快捷键：Esc 关闭、+/- 缩放、0 重置
 * - 响应式设计，适配各屏幕尺寸
 * - 高清渲染：避免 GPU 纹理化、亚像素偏移导致的模糊
 */

const lightboxClass = "mermaid-lightbox";
const openBodyClass = "mermaid-lightbox-open";

// ── 类型定义 ────────────────────────────────────────────────────────────

type LightboxElements = {
  dialog: HTMLDialogElement;
  svgWrapper: HTMLDivElement;
  controls: HTMLDivElement;
  btnZoomIn: HTMLButtonElement;
  btnZoomOut: HTMLButtonElement;
  btnReset: HTMLButtonElement;
  btnClose: HTMLButtonElement;
  zoomLabel: HTMLElement;
};

type Transform = {
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

type PinchState = {
  startDistance: number;
  startScale: number;
  startX: number;
  startY: number;
  centerX: number;
  centerY: number;
};

type TapState = {
  moved: boolean;
};

// ── 常量 ────────────────────────────────────────────────────────────────

const minScale = 0.25;
const maxScale = 8;
const wheelZoomStep = 0.1;
const buttonScaleStep = 0.25;
const dragSuppressDist = 4;
const pinchSensitivity = 1.35;
const clickSuppressMs = 280;
const doubleClickScale = 2.5;

// ── 状态 ────────────────────────────────────────────────────────────────

let transform: Transform = { scale: 1, x: 0, y: 0 };
let dragState: DragState | undefined;
let pinchState: PinchState | undefined;
let tapState: TapState | undefined;
let suppressClickUntil = 0;
let boundLightbox: LightboxElements | undefined;
let lastClickTime = 0;

// ─── 安装入口 ───────────────────────────────────────────────────────────

export function installMermaidLightbox(root: ParentNode = document): void {
  const diagrams = root.querySelectorAll<HTMLElement>("pre.mermaid[data-processed]");
  if (diagrams.length === 0) return;

  const lb = ensureLightbox();

  for (const d of diagrams) {
    if (d.dataset.lightboxReady === "true") continue;
    d.dataset.lightboxReady = "true";

    d.addEventListener("click", () => {
      const now = Date.now();
      if (now - lastClickTime < 350) {
        if (lb.dialog.open) {
          handleDoubleClick(lb);
        } else {
          openLightbox(d, lb);
        }
        lastClickTime = 0;
        return;
      }
      lastClickTime = now;

      const svg = d.querySelector<SVGElement>("svg");
      if (svg) openLightbox(d, lb);
    });
  }
}

// ─── DOM 创建 ───────────────────────────────────────────────────────────

function ensureLightbox(): LightboxElements {
  const existing = document.querySelector<HTMLDialogElement>(`.${lightboxClass}`);
  if (existing) {
    const lb = buildLightboxRefs(existing);
    boundLightbox = lb;
    return lb;
  }

  const dialog = document.createElement("dialog");
  dialog.className = lightboxClass;
  dialog.setAttribute("aria-label", "Mermaid diagram preview");
  dialog.tabIndex = -1;
  dialog.innerHTML = [
    '<div class="mermaid-lightbox-svg-wrapper"></div>',
    '<div class="mermaid-lightbox-controls">',
    '<div class="mermaid-lightbox-controls-left">',
    "</div>",
    '<div class="mermaid-lightbox-controls-center">',
    '<button class="mermaid-lightbox-btn" data-action="zoom-out" title="缩小 (−)">−</button>',
    '<span class="mermaid-lightbox-zoom-label">100%</span>',
    '<button class="mermaid-lightbox-btn" data-action="zoom-in" title="放大 (+)">+</button>',
    "</div>",
    '<div class="mermaid-lightbox-controls-right">',
    '<button class="mermaid-lightbox-btn" data-action="reset" title="重置 (0)">↺</button>',
    '<button class="mermaid-lightbox-btn" data-action="close" title="关闭 (Esc)">✕</button>',
    "</div>",
    "</div>"
  ].join("");

  document.body.append(dialog);

  const lb = buildLightboxRefs(dialog);
  boundLightbox = lb;

  // ── 按钮直接事件绑定（避免冒泡到 dialog 的关闭逻辑）──

  lb.btnZoomIn.addEventListener("click", (event) => {
    event.stopPropagation();
    zoomByStep(lb, buttonScaleStep);
  });

  lb.btnZoomOut.addEventListener("click", (event) => {
    event.stopPropagation();
    zoomByStep(lb, -buttonScaleStep);
  });

  lb.btnReset.addEventListener("click", (event) => {
    event.stopPropagation();
    resetZoom(lb);
  });

  lb.btnClose.addEventListener("click", (event) => {
    event.stopPropagation();
    closeLightbox(lb);
  });

  // 点击背景 / SVG wrapper 关闭
  dialog.addEventListener("click", (event) => {
    if (Date.now() < suppressClickUntil) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }

    const target = event.target as HTMLElement;
    if (target === lb.svgWrapper || target === dialog) {
      closeLightbox(lb);
    }
  });

  // 滚轮缩放
  dialog.addEventListener("wheel", (event) => zoomWheel(event, lb), { passive: false });

  // 指针拖拽
  dialog.addEventListener("pointerdown", (event) => startDrag(event, lb));
  dialog.addEventListener("pointermove", (event) => moveDrag(event, lb));
  dialog.addEventListener("pointerup", (event) => stopDrag(event, lb));
  dialog.addEventListener("pointercancel", (event) => stopDrag(event, lb));

  // 触摸
  dialog.addEventListener("touchstart", (event) => startTouch(event, lb), { passive: false });
  dialog.addEventListener("touchmove", (event) => moveTouch(event, lb), { passive: false });
  dialog.addEventListener("touchend", (event) => stopTouch(event, lb), { passive: false });
  dialog.addEventListener("touchcancel", (event) => stopTouch(event, lb), { passive: false });

  dialog.addEventListener("cancel", () => resetLightbox());
  dialog.addEventListener("close", () => resetLightbox());

  // 键盘
  document.addEventListener("keydown", (event) => handleKeyboard(event, lb));

  return lb;
}

function buildLightboxRefs(dialog: HTMLDialogElement): LightboxElements {
  return {
    dialog,
    svgWrapper: requireElement(dialog, ".mermaid-lightbox-svg-wrapper", HTMLDivElement),
    controls: requireElement(dialog, ".mermaid-lightbox-controls", HTMLDivElement),
    btnZoomIn: requireElement(dialog, '[data-action="zoom-in"]', HTMLButtonElement),
    btnZoomOut: requireElement(dialog, '[data-action="zoom-out"]', HTMLButtonElement),
    btnReset: requireElement(dialog, '[data-action="reset"]', HTMLButtonElement),
    btnClose: requireElement(dialog, '[data-action="close"]', HTMLButtonElement),
    zoomLabel: requireElement(dialog, ".mermaid-lightbox-zoom-label", HTMLElement)
  };
}

// ─── 打开 / 关闭 ────────────────────────────────────────────────────────

function openLightbox(trigger: HTMLElement, lb: LightboxElements): void {
  const svg = trigger.querySelector<SVGElement>("svg");
  if (!svg) return;

  // ── 高清渲染策略（防止模糊）──
  //
  // 模糊根源分析：
  // 1. GPU 纹理化：will-change: transform 触发 GPU 合成，SVG 被转为位图纹理
  // 2. 亚像素偏移：transform 值非整数像素，触发亚像素抗锯齿
  // 3. shape-rendering: crispEdges 对曲线/圆角不友好
  //
  // 解决方案：
  // 1. 移除 will-change，避免 GPU 纹理化
  // 2. transform 值强制整数像素
  // 3. 使用 geometricPrecision 而非 crispEdges

  const clone = svg.cloneNode(true) as SVGElement;

  // 保留 viewBox（SVG 的矢量坐标系）
  // viewBox 由 Mermaid 渲染时设置，反映图表的实际矢量尺寸

  // 移除内联尺寸属性，让 viewBox 控制自然尺寸
  clone.removeAttribute("width");
  clone.removeAttribute("height");

  // 清除内联样式中的尺寸限制
  clone.style.width = "";
  clone.style.height = "";
  clone.style.maxWidth = "";
  clone.style.maxHeight = "";

  // preserveAspectRatio: 保持比例居中
  if (!clone.hasAttribute("preserveAspectRatio")) {
    clone.setAttribute("preserveAspectRatio", "xMidYMid meet");
  }

  // ── 关键：渲染优化属性 ──
  //
  // geometricPrecision（推荐）:
  // - 精确渲染几何形状，适合 Mermaid 的圆角节点、曲线箭头
  // - 代价：渲染稍慢，但清晰度最佳
  //
  // crispEdges（不推荐）:
  // - 强制线条对齐像素网格，对水平/垂直线清晰
  // - 但对曲线/圆角会产生锯齿或模糊
  //
  // optimizeSpeed（不推荐）:
  // - 速度优先，可能牺牲清晰度
  clone.setAttribute("shape-rendering", "geometricPrecision");

  // 文本渲染优化
  // optimizeLegibility: 优先清晰度，适合阅读
  clone.setAttribute("text-rendering", "optimizeLegibility");

  // 图像渲染优化（对 SVG 内嵌图片有效）
  clone.setAttribute("image-rendering", "high-quality");

  lb.svgWrapper.innerHTML = "";
  lb.svgWrapper.appendChild(clone);

  // 重置变换（整数像素）
  transform = { scale: 1, x: 0, y: 0 };
  applyTransform(lb);
  updateZoomLabel(lb);

  document.body.classList.add(openBodyClass);
  if (!lb.dialog.open) {
    lb.dialog.showModal();
  }
  lb.dialog.focus({ preventScroll: true });
}

function closeLightbox(lb: LightboxElements): void {
  resetLightbox();
  if (lb.dialog.open) {
    lb.dialog.close();
  }
}

function resetLightbox(): void {
  document.body.classList.remove(openBodyClass);
  dragState = undefined;
  pinchState = undefined;
  tapState = undefined;
  suppressClickUntil = 0;
}

// ─── 缩放 ───────────────────────────────────────────────────────────────

function zoomByStep(lb: LightboxElements, delta: number): void {
  const nextScale = transform.scale * (1 + delta);
  zoomToPoint(lb, window.innerWidth / 2, window.innerHeight / 2, nextScale);
  updateZoomLabel(lb);
}

function zoomToPoint(lb: LightboxElements, cx: number, cy: number, scale: number): void {
  const nextScale = clamp(scale, minScale, maxScale);
  if (nextScale === transform.scale) return;

  const vpCx = window.innerWidth / 2;
  const vpCy = window.innerHeight / 2;
  const dx = cx - (vpCx + transform.x);
  const dy = cy - (vpCy + transform.y);
  const ratio = nextScale / transform.scale;

  // 关键：坐标值强制整数像素，避免亚像素模糊
  const newX = transform.x + dx * (1 - ratio);
  const newY = transform.y + dy * (1 - ratio);

  transform = {
    scale: nextScale,
    x: Math.round(newX),
    y: Math.round(newY)
  };
  applyTransform(lb);
}

function zoomWheel(event: WheelEvent, lb: LightboxElements): void {
  event.preventDefault();
  const factor = 1 - Math.sign(event.deltaY) * wheelZoomStep;
  zoomToPoint(lb, event.clientX, event.clientY, transform.scale * factor);
  updateZoomLabel(lb);
}

function resetZoom(lb: LightboxElements): void {
  // 强制整数像素
  transform = { scale: 1, x: 0, y: 0 };
  applyTransform(lb);
  updateZoomLabel(lb);
}

function handleDoubleClick(lb: LightboxElements): void {
  if (transform.scale > 1.1) {
    resetZoom(lb);
  } else {
    zoomToPoint(lb, window.innerWidth / 2, window.innerHeight / 2, doubleClickScale);
    updateZoomLabel(lb);
  }
}

function updateZoomLabel(lb: LightboxElements): void {
  lb.zoomLabel.textContent = `${Math.round(transform.scale * 100)}%`;
}

// ─── 拖拽 ───────────────────────────────────────────────────────────────

function startDrag(event: PointerEvent, lb: LightboxElements): void {
  const target = event.target as HTMLElement;
  if (target.closest(".mermaid-lightbox-controls")) return;

  if (event.pointerType === "touch") {
    event.preventDefault();
    return;
  }

  event.preventDefault();
  capturePointer(lb.dialog, event.pointerId);

  dragState = {
    pointerId: event.pointerId,
    startX: event.clientX,
    startY: event.clientY,
    originX: transform.x,
    originY: transform.y,
    moved: false
  };
  lb.svgWrapper.classList.add("mermaid-lightbox-dragging");
}

function moveDrag(event: PointerEvent, lb: LightboxElements): void {
  if (event.pointerType === "touch") {
    event.preventDefault();
    return;
  }

  if (!dragState || event.pointerId !== dragState.pointerId) return;

  event.preventDefault();
  const dx = event.clientX - dragState.startX;
  const dy = event.clientY - dragState.startY;

  if (Math.hypot(dx, dy) > dragSuppressDist) {
    dragState.moved = true;
    suppressClick();
  }

  // 关键：拖拽坐标强制整数像素
  transform = {
    ...transform,
    x: Math.round(dragState.originX + dx),
    y: Math.round(dragState.originY + dy)
  };
  applyTransform(lb);
}

function stopDrag(event: PointerEvent, lb: LightboxElements): void {
  if (event.pointerType === "touch") {
    event.preventDefault();
    return;
  }

  releasePointer(lb.dialog, event.pointerId);

  if (dragState?.moved) {
    suppressClick();
  }

  dragState = undefined;
  lb.svgWrapper.classList.remove("mermaid-lightbox-dragging");
}

// ─── 触摸 ───────────────────────────────────────────────────────────────

function startTouch(event: TouchEvent, lb: LightboxElements): void {
  const target = event.target as HTMLElement;
  if (target.closest(".mermaid-lightbox-controls")) return;

  event.preventDefault();

  if (event.touches.length >= 2) {
    tapState = undefined;
    dragState = undefined;
    startPinch(event, lb);
    return;
  }

  const touch = event.touches[0];
  if (!touch) return;

  tapState = { moved: false };

  dragState = {
    pointerId: touch.identifier,
    startX: touch.clientX,
    startY: touch.clientY,
    originX: transform.x,
    originY: transform.y,
    moved: false
  };
  lb.svgWrapper.classList.add("mermaid-lightbox-dragging");
}

function moveTouch(event: TouchEvent, lb: LightboxElements): void {
  event.preventDefault();

  if (event.touches.length >= 2) {
    tapState = undefined;
    if (!pinchState) startPinch(event, lb);
    applyPinch(lb, touchMetrics(event));
    return;
  }

  const touch = event.touches[0];
  if (!touch || !dragState || touch.identifier !== dragState.pointerId) return;

  const dx = touch.clientX - dragState.startX;
  const dy = touch.clientY - dragState.startY;

  if (Math.hypot(dx, dy) > dragSuppressDist) {
    dragState.moved = true;
    if (tapState) tapState.moved = true;
    suppressClick();
  }

  // 关键：触摸坐标强制整数像素
  transform = {
    ...transform,
    x: Math.round(dragState.originX + dx),
    y: Math.round(dragState.originY + dy)
  };
  applyTransform(lb);
}

function stopTouch(event: TouchEvent, lb: LightboxElements): void {
  event.preventDefault();

  if (pinchState) {
    suppressClick();
    pinchState = undefined;
  }

  if (event.touches.length >= 2) {
    startPinch(event, lb);
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

  if (dragState?.moved) suppressClick();

  if (tapState && tapState.moved === false) {
    suppressClick();
    closeLightbox(lb);
  }

  tapState = undefined;
  dragState = undefined;
  lb.svgWrapper.classList.remove("mermaid-lightbox-dragging");
}

// ─── 双指缩放 ───────────────────────────────────────────────────────────

function startPinch(event: TouchEvent, lb: LightboxElements): void {
  const m = touchMetrics(event);
  if (!m) return;

  dragState = undefined;
  pinchState = {
    startDistance: m.distance,
    startScale: transform.scale,
    startX: transform.x,
    startY: transform.y,
    centerX: m.centerX,
    centerY: m.centerY
  };
  lb.svgWrapper.classList.add("mermaid-lightbox-dragging");
}

function applyPinch(
  lb: LightboxElements,
  m: { distance: number; centerX: number; centerY: number } | undefined
): void {
  if (!pinchState || !m || pinchState.startDistance === 0) return;

  suppressClick();
  const ratio = m.distance / pinchState.startDistance;
  const nextScale = clamp(pinchState.startScale * ratio ** pinchSensitivity, minScale, maxScale);
  const vpCx = window.innerWidth / 2;
  const vpCy = window.innerHeight / 2;
  const dx = m.centerX - (vpCx + pinchState.startX);
  const dy = m.centerY - (vpCy + pinchState.startY);
  const scaleRatio = nextScale / pinchState.startScale;

  // 关键：双指缩放坐标强制整数像素
  transform = {
    scale: nextScale,
    x: Math.round(pinchState.startX + dx * (1 - scaleRatio)),
    y: Math.round(pinchState.startY + dy * (1 - scaleRatio))
  };
  applyTransform(lb);
  updateZoomLabel(lb);
}

function touchMetrics(event: TouchEvent): { distance: number; centerX: number; centerY: number } | undefined {
  const a = event.touches.item(0);
  const b = event.touches.item(1);
  if (!a || !b) return undefined;

  const dx = b.clientX - a.clientX;
  const dy = b.clientY - a.clientY;
  return {
    distance: Math.hypot(dx, dy),
    centerX: (a.clientX + b.clientX) / 2,
    centerY: (a.clientY + b.clientY) / 2
  };
}

// ─── 键盘 ───────────────────────────────────────────────────────────────

function handleKeyboard(event: KeyboardEvent, lb: LightboxElements): void {
  if (!lb.dialog.open) return;

  switch (event.key) {
    case "Escape":
      closeLightbox(lb);
      break;
    case "+":
    case "=":
      event.preventDefault();
      zoomByStep(lb, buttonScaleStep);
      break;
    case "-":
      event.preventDefault();
      zoomByStep(lb, -buttonScaleStep);
      break;
    case "0":
      event.preventDefault();
      resetZoom(lb);
      break;
  }
}

// ─── 变换应用 ───────────────────────────────────────────────────────────

function applyTransform(lb: LightboxElements): void {
  const svg = lb.svgWrapper.querySelector("svg");
  if (!svg) return;

  // 关键：所有 transform 值强制整数像素，避免亚像素模糊
  const x = Math.round(transform.x);
  const y = Math.round(transform.y);
  const scale = roundToStep(transform.scale, 0.01); // 缩放值精确到 0.01

  svg.style.transform = `translate(${x}px, ${y}px) scale(${scale})`;
  svg.style.transformOrigin = "center center";
}

// ─── 工具函数 ───────────────────────────────────────────────────────────

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

/**
 * 数值精确到指定步长（避免浮点精度问题）
 */
function roundToStep(v: number, step: number): number {
  return Math.round(v / step) * step;
}

function round(v: number): number {
  return Math.round(v * 1000) / 1000;
}

function suppressClick(): void {
  suppressClickUntil = Date.now() + clickSuppressMs;
}

function capturePointer(el: HTMLElement, id: number): void {
  try { el.setPointerCapture(id); } catch { /* ignore */ }
}

function releasePointer(el: HTMLElement, id: number): void {
  try { el.releasePointerCapture(id); } catch { /* ignore */ }
}

function requireElement<T extends Element>(
  root: ParentNode,
  selector: string,
  type: new (...args: never[]) => T
): T {
  const el = root.querySelector(selector);
  if (!(el instanceof type)) {
    throw new Error(`Missing mermaid lightbox element: ${selector}`);
  }
  return el;
}