/**
 * 修复被污染的 mermaid viewBox。
 *
 * 部分浏览器环境（典型：带翻译/深色类扩展的 Edge）会在 mermaid 渲染测量
 * 期间向其临时挂载的测量容器注入元素，令 getBBox 命中 Chromium 的
 * 2^14 几何钳制（≈16384），mermaid 据此把 svg 的 width/height/viewBox
 * 标成远大于实际内容的值：图形只占画布左上角一小块，正文出现大片空白，
 * 灯箱的初始适配比例也随之骤降（内容被缩到不可读）。
 *
 * 渲染完成后在实际 DOM 中复测内容 bbox，若标注的 viewBox 超出真实内容
 * 两倍以上，视为被污染，按真实内容重设 viewBox 与宽高。正常渲染的
 * viewBox 与内容 bbox 基本相等（比值 ≈ 1），不受影响。
 */
export function repairInflatedViewBox(svg: SVGSVGElement): void {
  const vb = svg.viewBox.baseVal;
  if (vb.width === 0 || vb.height === 0) return;

  let bb: DOMRect;
  try {
    bb = svg.getBBox();
  } catch {
    return;
  }

  // 内容 bbox 全零说明 svg 在不可见容器中被测量（display:none 等），
  // 此时任何真实 viewBox 都满足“超出内容两倍”，继续会按 ~16×16 重设导致图形整体消失，
  // 与被污染的放大正好相反方向
  if (bb.width === 0 && bb.height === 0) {
    return;
  }

  if (vb.width > bb.width * 2 + 16 || vb.height > bb.height * 2 + 16) {
    const pad = 8;
    const x = bb.x - pad;
    const y = bb.y - pad;
    const w = bb.width + pad * 2;
    const h = bb.height + pad * 2;
    svg.setAttribute("viewBox", `${x} ${y} ${w} ${h}`);
    svg.setAttribute("width", String(w));
    svg.setAttribute("height", String(h));
  }
}
