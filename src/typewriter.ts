/* =====================================================================
   typewriter.ts — 打字机式文字浮现
   SEALING 状态:用户原文以打字机效果在页面中央重新浮现
   (仪式感:机器在「读」你的记忆)。
   ===================================================================== */

/**
 * 把文字逐字写入 target。
 * @param target  目标元素(会被清空后逐字填充)
 * @param text    完整文本
 * @param charDelay 每字间隔(毫秒)
 */
export function typewriter(
  target: HTMLElement,
  text: string,
  charDelay = 55,
): Promise<void> {
  return new Promise((resolve) => {
    target.textContent = '';
    const chars = Array.from(text); // 兼容代理对
    let i = 0;

    const tick = () => {
      if (i >= chars.length) {
        resolve();
        return;
      }
      // 文本节点追加,避免反复触发 layout 重排(span 包裹)
      target.appendChild(document.createTextNode(chars[i]));
      i += 1;
      setTimeout(tick, charDelay);
    };

    tick();
  });
}
