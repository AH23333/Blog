const STORAGE_KEY = "crt-effect";

type CrtEffect = {
  id: string;
  name: string;
  desc: string;
};

const EFFECTS: CrtEffect[] = [
  { id: "", name: "无效果", desc: "默认" },
  { id: "crt-scanlines", name: "扫描线", desc: "Scanline" },
  { id: "crt-display", name: "CRT 显示", desc: "CRT" },
  { id: "crt-interlace", name: "隔行扫描", desc: "Interlace" },
  { id: "crt-static", name: "雪花噪点", desc: "Static" },
  { id: "crt-desaturate", name: "色彩失真", desc: "Desaturate" },
  { id: "crt-curvature", name: "屏幕曲率", desc: "Curvature" }
];

let currentEffect = "";

function loadEffect(): string {
  return localStorage.getItem(STORAGE_KEY) ?? "";
}

function saveEffect(effect: string): void {
  localStorage.setItem(STORAGE_KEY, effect);
}

function applyEffect(effectId: string): void {
  const body = document.body;
  const overlay = document.getElementById("crt-overlay");

  // 移除所有效果类
  for (const { id } of EFFECTS) {
    if (id) body.classList.remove(id);
  }

  currentEffect = effectId;

  if (effectId && overlay) {
    body.classList.add(effectId);
    overlay.style.display = "";
  } else if (overlay) {
    overlay.style.display = "none";
  }
}

function buildPanel(): HTMLDivElement {
  const panel = document.createElement("div");
  panel.className = "crt-panel hidden";
  panel.setAttribute("role", "listbox");
  panel.setAttribute("aria-label", "页面风格");

  const title = document.createElement("div");
  title.className = "crt-panel-title";
  title.textContent = "页面风格";
  panel.appendChild(title);

  const saved = loadEffect();

  for (const effect of EFFECTS) {
    const btn = document.createElement("button");
    btn.className = "crt-option";
    btn.setAttribute("role", "option");
    btn.setAttribute("aria-selected", String(effect.id === saved));
    btn.type = "button";

    const check = document.createElement("span");
    check.className = "crt-option-check";
    check.textContent = effect.id === saved ? "*" : "";

    const name = document.createElement("span");
    name.className = "crt-option-name";
    name.textContent = effect.name;

    const desc = document.createElement("span");
    desc.className = "crt-option-desc";
    desc.textContent = effect.desc;

    btn.appendChild(check);
    btn.appendChild(name);
    btn.appendChild(desc);

    btn.addEventListener("click", () => {
      saveEffect(effect.id);
      applyEffect(effect.id);
      updatePanelChecks(panel, effect.id);
      panel.classList.add("hidden");
      const toggle = document.getElementById("crt-toggle");
      if (toggle) toggle.setAttribute("aria-expanded", "false");
    });

    panel.appendChild(btn);
  }

  return panel;
}

function updatePanelChecks(panel: HTMLDivElement, activeId: string): void {
  const options = panel.querySelectorAll<HTMLButtonElement>(".crt-option");
  for (const opt of options) {
    const check = opt.querySelector(".crt-option-check");
    const id = EFFECTS[Array.from(panel.querySelectorAll(".crt-option")).indexOf(opt)]?.id ?? "";
    opt.setAttribute("aria-selected", String(id === activeId));
    if (check) check.textContent = id === activeId ? "*" : "";
  }
}

let panel: HTMLDivElement | null = null;

function togglePanel(): void {
  const toggle = document.getElementById("crt-toggle");
  if (!toggle) return;

  if (!panel) {
    panel = buildPanel();
    document.body.appendChild(panel);
  }

  const isHidden = panel.classList.toggle("hidden");
  if (!isHidden) {
    updatePanelChecks(panel, currentEffect);
  }

  toggle.setAttribute("aria-expanded", String(!isHidden));
}

function closePanelOnClickOutside(event: MouseEvent): void {
  if (!panel || panel.classList.contains("hidden")) return;

  const target = event.target as HTMLElement;
  const toggle = document.getElementById("crt-toggle");

  if (!panel.contains(target) && target !== toggle && !toggle?.contains(target)) {
    panel.classList.add("hidden");
    if (toggle) toggle.setAttribute("aria-expanded", "false");
  }
}

export function initCrtPanel(): void {
  const toggle = document.getElementById("crt-toggle");
  if (!toggle) return;

  toggle.addEventListener("click", (e) => {
    e.stopPropagation();
    togglePanel();
  });

  document.addEventListener("click", closePanelOnClickOutside);

  // 加载保存的效果
  const saved = loadEffect();
  if (saved) {
    applyEffect(saved);
  }
}
