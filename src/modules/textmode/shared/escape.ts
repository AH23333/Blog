/**
 * 共享转义工具函数
 *
 * 提供项目中多处使用的字符串转义和正则表达式转义功能，
 * 避免各模块重复实现相同逻辑。
 */

/** 转义正则表达式特殊字符，用于构建动态正则表达式 */
export function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
