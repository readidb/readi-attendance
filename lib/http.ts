export async function requestJson<T>(url: string, init: RequestInit = {}, fallback = "요청을 처리하지 못했습니다."): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  const response = await fetch(url, { cache: "no-store", ...init, headers });
  const result = await response.json() as T & { message?: string };
  if (!response.ok) throw new Error(result.message || fallback);
  return result;
}
