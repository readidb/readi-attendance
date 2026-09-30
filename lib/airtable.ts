import "server-only";

import type { AirtableRecord } from "@/lib/types";

const AIRTABLE_API = "https://api.airtable.com/v0";

function config(baseIdOverride?: string) {
  const token = process.env.AIRTABLE_TOKEN;
  const baseId = baseIdOverride || process.env.AIRTABLE_BASE_ID;
  if (!token || !baseId) {
    throw new Error("Airtable 환경변수가 설정되지 않았습니다.");
  }
  return { token, baseId };
}

async function airtableFetch(
  path: string,
  init?: RequestInit,
  attempt = 0,
  baseIdOverride?: string,
): Promise<Response> {
  const { token, baseId } = config(baseIdOverride);
  const response = await fetch(`${AIRTABLE_API}/${baseId}/${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...init?.headers,
    },
    cache: "no-store",
  });
  if (response.status === 429 && attempt < 3) {
    await new Promise((resolve) => setTimeout(resolve, 400 * (attempt + 1)));
    return airtableFetch(path, init, attempt + 1, baseIdOverride);
  }
  if (!response.ok) {
    const detail = await response.text();
    console.error("Airtable request failed", response.status, detail.slice(0, 500));
    throw new Error("Airtable 데이터 서버와 통신하지 못했습니다.");
  }
  return response;
}

export async function listRecords(
  tableId: string,
  options: {
    filterByFormula?: string;
    fields?: string[];
    maxRecords?: number;
    sortField?: string;
    sortDirection?: "asc" | "desc";
    baseId?: string;
  } = {},
): Promise<AirtableRecord[]> {
  const params = new URLSearchParams();
  params.set("returnFieldsByFieldId", "true");
  if (options.filterByFormula) params.set("filterByFormula", options.filterByFormula);
  if (options.maxRecords) params.set("maxRecords", String(options.maxRecords));
  if (options.sortField) {
    params.set("sort[0][field]", options.sortField);
    params.set("sort[0][direction]", options.sortDirection || "desc");
  }
  options.fields?.forEach((field) => params.append("fields[]", field));

  const records: AirtableRecord[] = [];
  let offset: string | undefined;
  do {
    if (offset) params.set("offset", offset);
    const response = await airtableFetch(`${tableId}?${params.toString()}`, undefined, 0, options.baseId);
    const data = (await response.json()) as { records: AirtableRecord[]; offset?: string };
    records.push(...data.records);
    offset = data.offset;
  } while (offset && (!options.maxRecords || records.length < options.maxRecords));
  return options.maxRecords ? records.slice(0, options.maxRecords) : records;
}

export async function getRecord(
  tableId: string,
  recordId: string,
  baseIdOverride?: string,
): Promise<AirtableRecord | null> {
  const { token, baseId } = config(baseIdOverride);
  const response = await fetch(
    `${AIRTABLE_API}/${baseId}/${tableId}/${recordId}?returnFieldsByFieldId=true`,
    {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
    },
  );
  if (response.status === 404) return null;
  if (!response.ok) throw new Error("Airtable 데이터 서버와 통신하지 못했습니다.");
  return (await response.json()) as AirtableRecord;
}

export async function createRecord(
  tableId: string,
  fields: Record<string, unknown>,
  baseId?: string,
): Promise<AirtableRecord> {
  const response = await airtableFetch(tableId, {
    method: "POST",
    body: JSON.stringify({ records: [{ fields }], typecast: false, returnFieldsByFieldId: true }),
  }, 0, baseId);
  const data = (await response.json()) as { records: AirtableRecord[] };
  return data.records[0];
}

export async function updateRecord(
  tableId: string,
  recordId: string,
  fields: Record<string, unknown>,
  baseId?: string,
): Promise<AirtableRecord> {
  const response = await airtableFetch(`${tableId}/${recordId}`, {
    method: "PATCH",
    body: JSON.stringify({ fields, typecast: false, returnFieldsByFieldId: true }),
  }, 0, baseId);
  return (await response.json()) as AirtableRecord;
}

export function formulaString(value: string): string {
  return `'${value.replace(/\\/g, "\\\\").replace(/'/g, "\\'")}'`;
}

export function selectName(value: unknown): string {
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && "name" in value) {
    return String((value as { name?: unknown }).name ?? "");
  }
  return "";
}

export function firstLinkedValue(value: unknown): string {
  if (!Array.isArray(value) || value.length === 0) return "";
  const first = value[0];
  if (typeof first === "string") return first;
  if (first && typeof first === "object" && "name" in first) {
    return String((first as { name?: unknown }).name ?? "");
  }
  return "";
}
