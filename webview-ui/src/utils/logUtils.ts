export const getLevelBorderColor = (level: string): string => {
  const colors: Record<string, string> = {
    error: 'var(--vscode-charts-red, #ef4444)',
    warn: 'var(--vscode-charts-yellow, #eab308)',
    info: 'var(--vscode-charts-blue, #3b82f6)',
    debug: 'var(--vscode-disabledForeground, #6b7280)'
  };
  return colors[level] || 'var(--vscode-disabledForeground, #6b7280)';
};

/**
 * Resolve a CSS custom property to a concrete color value.
 * Needed for SVG presentation attributes (e.g. React Flow arrow markers),
 * where `var(...)` is not resolved by the browser.
 */
export const resolveCssVar = (name: string, fallback: string): string => {
  if (typeof document === 'undefined') return fallback;
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || fallback;
};
