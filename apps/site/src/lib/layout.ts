/** Grid columns from a CMS number, clamped to 1…max. Full class names, so Tailwind finds them. */
const COLUMNS = [
  "",
  "",
  "sm:grid-cols-2",
  "sm:grid-cols-2 lg:grid-cols-3",
  "sm:grid-cols-2 lg:grid-cols-4",
  "sm:grid-cols-3 lg:grid-cols-5",
  "sm:grid-cols-3 lg:grid-cols-6",
];

export const columnClasses = (columns: number, max: number) =>
  COLUMNS[Math.min(max, Math.max(1, Math.round(columns) || 1))];
