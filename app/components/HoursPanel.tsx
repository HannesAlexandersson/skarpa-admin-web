"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";

type Hour = { weekday: number; opensAt: string; closesAt: string; slotMinutes: number };
type Blocked = { date: string; reason: string | null };
const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

const card = "bg-zinc-900 p-4 sm:p-5 rounded-2xl border border-zinc-800 space-y-4";
const input = "px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-700 text-sm";
const btn = "px-3.5 py-2 rounded-xl text-sm font-medium transition disabled:opacity-50";

export default function HoursPanel({ token }: { token: string }) {
  const [rows, setRows] = useState<(Hour & { open: boolean })[]>([]);
  const [blocked, setBlocked] = useState<Blocked[]>([]);
  const [newDate, setNewDate] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setError("");
    try {
      const [h, b] = await Promise.all([apiFetch<Hour[]>(token, "/api/pickup-hours"), apiFetch<Blocked[]>(token, "/api/blocked-dates")]);
      setRows(DAYS.map((_, i) => {
        const found = h.find((x) => x.weekday === i + 1);
        return found ? { ...found, open: true } : { weekday: i + 1, opensAt: "08:00", closesAt: "18:00", slotMinutes: 30, open: false };
      }));
      setBlocked(b);
    } catch (e) { setError(e instanceof Error ? e.message : "Failed to load"); }
  }, [token]);

  useEffect(() => { const t = setTimeout(load, 0); return () => clearTimeout(t); }, [load]);

  async function run(action: () => Promise<unknown>, done: string) {
    setBusy(true); setError(""); setNotice("");
    try { await action(); setNotice(done); await load(); }
    catch (e) { setError(e instanceof Error ? e.message : "Something went wrong"); }
    finally { setBusy(false); }
  }

  const update = (i: number, patch: Partial<Hour & { open: boolean }>) => setRows((all) => all.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  return (
    <section className="space-y-4">
      {error && <div className="p-4 rounded-xl bg-red-950/60 border border-red-800 text-red-200 text-sm">{error}</div>}
      {notice && <div className="p-4 rounded-xl bg-emerald-950/60 border border-emerald-800 text-emerald-200 text-sm">{notice}</div>}

      <div className={card}>
        <div>
          <h2 className="font-semibold">Pickup hours</h2>
          <p className="text-sm text-zinc-400">Customers can only pick times inside these hours. Closed days cannot be booked.</p>
        </div>
        <div className="space-y-2">
          {rows.map((r, i) => (
            <div key={r.weekday} className="flex flex-wrap items-center gap-2 text-sm">
              <span className="w-24 font-medium">{DAYS[i]}</span>
              <label className="flex items-center gap-1.5 w-20 text-zinc-300"><input type="checkbox" checked={r.open} onChange={(e) => update(i, { open: e.target.checked })} /> Open</label>
              <input type="time" aria-label={`${DAYS[i]} opens`} value={r.opensAt} disabled={!r.open} onChange={(e) => update(i, { opensAt: e.target.value })} className={input} />
              <span className="text-zinc-500">–</span>
              <input type="time" aria-label={`${DAYS[i]} closes`} value={r.closesAt} disabled={!r.open} onChange={(e) => update(i, { closesAt: e.target.value })} className={input} />
              <select aria-label={`${DAYS[i]} slot length`} value={r.slotMinutes} disabled={!r.open} onChange={(e) => update(i, { slotMinutes: Number(e.target.value) })} className={input}>
                {[15, 30, 45, 60, 90, 120].map((m) => <option key={m} value={m}>{m} min slots</option>)}
              </select>
            </div>
          ))}
        </div>
        <button className={`${btn} bg-amber-500 hover:bg-amber-400 text-zinc-950`} disabled={busy}
          onClick={() => run(() => Promise.all(rows.map((r) => r.open
            ? apiFetch(token, `/api/pickup-hours/${r.weekday}`, { method: "PUT", body: JSON.stringify({ weekday: r.weekday, opensAt: r.opensAt, closesAt: r.closesAt, slotMinutes: r.slotMinutes }) })
            : apiFetch(token, `/api/pickup-hours/${r.weekday}`, { method: "DELETE" }))), "Pickup hours saved.")}>
          Save hours
        </button>
      </div>

      <div className={card}>
        <div>
          <h2 className="font-semibold">Closed dates</h2>
          <p className="text-sm text-zinc-400">Holidays, vacations or fully booked days.</p>
        </div>
        <form className="flex flex-wrap gap-2 text-sm" onSubmit={(e) => {
          e.preventDefault();
          run(() => apiFetch(token, "/api/blocked-dates", { method: "POST", body: JSON.stringify({ date: newDate, reason: reason || null }) }), "Date closed.")
            .then(() => { setNewDate(""); setReason(""); });
        }}>
          <input required type="date" aria-label="Date to close" value={newDate} onChange={(e) => setNewDate(e.target.value)} className={input} />
          <input placeholder="Reason (optional)" maxLength={200} value={reason} onChange={(e) => setReason(e.target.value)} className={`${input} flex-1 min-w-40`} />
          <button type="submit" disabled={busy} className={`${btn} bg-amber-500 hover:bg-amber-400 text-zinc-950`}>Close date</button>
        </form>
        <ul className="divide-y divide-zinc-800 text-sm">
          {blocked.length === 0 && <li className="py-2 text-zinc-500">No closed dates.</li>}
          {blocked.map((b) => (
            <li key={b.date} className="py-2.5 flex items-center justify-between gap-3">
              <span><span className="font-medium">{b.date}</span>{b.reason && <span className="text-zinc-400"> · {b.reason}</span>}</span>
              <button className={`${btn} text-zinc-300 hover:bg-zinc-800`} disabled={busy}
                onClick={() => run(() => apiFetch(token, `/api/blocked-dates/${b.date}`, { method: "DELETE" }), "Date reopened.")}>Reopen</button>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
