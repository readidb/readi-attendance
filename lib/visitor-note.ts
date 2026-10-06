// Reuse the existing note field; no Airtable schema change is required.
const NAME_PREFIX = "방문자명: ";

export function splitVisitorNote(value: string): { visitorName: string; note: string } {
  if (!value.startsWith(NAME_PREFIX)) return { visitorName: "", note: value };
  const [first, ...rest] = value.split(/\r?\n/);
  return { visitorName: first.slice(NAME_PREFIX.length).trim(), note: rest.join("\n") };
}

export function joinVisitorNote(visitorName: string, note: string): string {
  const name = visitorName.replace(/[\r\n]+/g, " ").trim();
  return name ? `${NAME_PREFIX}${name}${note ? `\n${note}` : ""}` : note;
}
