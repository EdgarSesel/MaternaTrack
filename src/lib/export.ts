/**
 * Data export utilities — CSV generation for patient data.
 * No PHI in filenames or URL params.
 */

type CsvRow = Record<string, string | number | boolean | null | undefined>;

/**
 * Convert an array of objects to CSV string.
 * Headers derived from first row's keys.
 */
export function toCsv(rows: CsvRow[]): string {
  if (rows.length === 0) return "";

  const headers = Object.keys(rows[0]);
  const escape = (v: unknown): string => {
    if (v === null || v === undefined) return "";
    const str = String(v);
    // Escape double quotes and wrap in quotes if contains comma, newline, or quote
    if (str.includes(",") || str.includes("\n") || str.includes('"')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const lines = [
    headers.join(","),
    ...rows.map((row) => headers.map((h) => escape(row[h])).join(",")),
  ];

  return lines.join("\n");
}

export function csvResponse(csv: string, filename: string): Response {
  return new Response(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
