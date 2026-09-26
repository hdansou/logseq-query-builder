/** EDN string literal with quotes and backslashes escaped. */
export const str = (s: string) => `"${s.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
