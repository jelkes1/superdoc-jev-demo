export const money = (n: number) => `$${n.toFixed(n >= 1 ? 2 : n < 0.01 ? 6 : 4)}`;
export const seconds = (n: number) => `${(n / 1000).toFixed(2)}s`;
