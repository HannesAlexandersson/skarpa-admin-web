const API_URL = process.env.NEXT_PUBLIC_API_URL!;

export async function apiFetch<T>(token: string, path: string, init: RequestInit = {}): Promise<T> {
  const isFormData = typeof FormData !== "undefined" && init.body instanceof FormData;
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(init.body && !isFormData ? { "Content-Type": "application/json" } : {}),
      ...init.headers,
    },
  });
  if (!res.ok) {
    let message = `API error (${res.status})`;
    try {
      const body = await res.json();
      if (body?.error) message = body.error;
    } catch { }
    throw new Error(message);
  }
  return (res.status === 204 ? undefined : await res.json()) as T;
}

export const PAYMENT_STATUSES = ["pending", "invoiced", "paid", "refunded", "cancelled"] as const;
export const formatKr = (ore?: number | null) => (ore == null ? "—" : `${(ore / 100).toLocaleString("sv-SE")} kr`);
export const toOre = (kr: string) => Math.round(Number(kr.replace(",", ".")) * 100);