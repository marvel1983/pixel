// Escape XML special chars; wrap long text in CDATA
function xmlEscape(value: string): string {
  if (value.includes("<") || value.includes(">") || value.includes("&") || value.length > 100) {
    return `<![CDATA[${value.replace(/\]\]>/g, "]]]]><![CDATA[>")}]]>`;
  }
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function rowToXmlItem(row: Record<string, string>): string {
  const fields = Object.entries(row)
    .map(([key, val]) => `    <${key}>${xmlEscape(val)}</${key}>`)
    .join("\n");
  return `  <item>\n${fields}\n  </item>\n`;
}

export function xmlHeader(feedName: string): string {
  const escaped = feedName.replace(/&/g, "&amp;").replace(/</g, "&lt;");
  return (
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<rss xmlns:g="http://base.google.com/ns/1.0" version="2.0">\n` +
    `<channel>\n` +
    `<title>${escaped}</title>\n`
  );
}

export const XML_FOOTER = `</channel>\n</rss>\n`;

// CSV helpers
function csvEscape(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function rowToCsvLine(row: Record<string, string>, headers: string[]): string {
  return headers.map((h) => csvEscape(row[h] ?? "")).join(",") + "\n";
}

export function csvHeaderLine(headers: string[]): string {
  return headers.map(csvEscape).join(",") + "\n";
}
