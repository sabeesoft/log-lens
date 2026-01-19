export const getLevelBorderColor = (level: string): string => {
  const colors: Record<string, string> = {
    error: '#ef4444',
    warn: '#eab308',
    info: '#3b82f6',
    debug: '#6b7280'
  };
  return colors[level] || '#6b7280';
};
