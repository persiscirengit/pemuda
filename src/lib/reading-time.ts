/**
 * Calculates estimated reading time based on standard 200 words per minute ceiling.
 */
export function calculateReadingTimeMinutes(textOrHtml: string): number {
  if (!textOrHtml) return 1;
  const plainText = textOrHtml.replace(/<[^>]*>/g, " ").trim();
  if (!plainText) return 1;
  const words = plainText.split(/\s+/).filter(Boolean);
  return Math.max(1, Math.ceil(words.length / 200));
}
