/**
 * Strip HTML tags and normalize whitespace from user input.
 * Apply to all user-facing text fields before persisting to DB.
 */
export function sanitizeString(input: string): string {
  return input
    .replace(/<[^>]*>/g, "") // Strip HTML tags
    .replace(/\s+/g, " ")    // Normalize whitespace
    .trim();
}
