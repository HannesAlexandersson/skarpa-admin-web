"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch, formatKr, toOre } from "@/lib/api";

type Tier = { minKnives: number; pricePerKnifeOre: number };
type Campaign = { id: string; name: string; firstKnifePriceOre: number; startsOn: string | null; endsOn: string | null; active: boolean };
type Method = { code: string; label: string; timing: string; active: boolean };

const card = "bg-zinc-900 p-4 sm:p-5 rounded-2xl border border-zinc-800 space-y-4";
const input = "px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-700 text-sm";
const btn = "px-3.5 py-2 rounded-xl text-sm font-medium transition disabled:opacity-50";

function preview(tiers: Tier[], n: number, first?: number) {
  const tier = [...tiers].sort((a, b) => b.minKnives - a.minKnives).find((t) => t.minKnives <= n);
  if (!tier) return null;
  return first == null ? tier.pricePerKnifeOre * n : first + tier.pricePerKnifeOre * (n - 1);
}

export default function PricingPanel({ token }: { token: string }) {
  const [tiers, setTiers] = useState<{ minKnives: string; price: string }[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [methods, setMethods] = useState<Method[]>([]);
  const [form, setForm] = useState({ name: "", price: "", startsOn: "", endsOn: "", active: true });
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setError("");
    try {
      const [t, c, m] = await Promise.all([
        apiFetch<Tier[]>(token, "/api/pricing/tiers"),
        apiFetch<Campaign[]>(token, "/api/pricing/campaigns"),
        apiFetch<Method[]>(token, "/api/payment-methods"),
      ]);
      setTiers(t.map((x) => ({ minKnives: String(x.minKnives), price: String(x.pricePerKnifeOre / 100) })));
      setCampaigns(c);
      setMethods(m);
    } catch (e) { setError(e instanceof Error ? e.message : "Failed to load"); }
  }, [token]);

  useEffect(() => { const t = setTimeout(load, 0); return () => clearTimeout(t); }, [load]);

  async function run(action: () => Promise<unknown>, done: string) {
    setBusy(true); setError(""); setNotice("");
    try { await action(); setNotice(done); await load(); }
    catch (e) { setError(e instanceof Error ? e.message : "Something went wrong"); }
    finally { setBusy(false); }
  }

  const parsedTiers: Tier[] = tiers.map((t) => ({ minKnives: Number(t.minKnives), pricePerKnifeOre: toOre(t.price) }));
  const active = campaigns.find((c) => c.active);

  return (
    <section className="space-y-4">
      {error && <div className="p-4 rounded-xl bg-red-950/60 border border-red-800 text-red-200 text-sm">{error}</div>}
      {notice && <div className="p-4 rounded-xl bg-emerald-950/60 border border-emerald-800 text-emerald-200 text-sm">{notice}</div>}

      <div className={card}>
        <div>
          <h2 className="font-semibold">Price per knife</h2>
          <p className="text-sm text-zinc-400">Every knife in a booking gets the price of the highest matching row. Changes apply to new bookings only.</p>
        </div>
        <div className="space-y-2">
          {tiers.map((t, i) => (
            <div key={i} className="flex items-center gap-2 text-sm">
              <span className="text-zinc-400">From</span>
              <input type="number" min={1} max={20} value={t.minKnives} aria-label="From number of knives" className={`${input} w-20`}
                onChange={(e) => setTiers((all) => all.map((x, j) => (j === i ? { ...x, minKnives: e.target.value } : x)))} />
              <span className="text-zinc-400">knives:</span>
              <input type="number" min={0} step="0.01" value={t.price} aria-label="Price per knife in kr" className={`${input} w-28`}
                onChange={(e) => setTiers((all) => all.map((x, j) => (j === i ? { ...x, price: e.target.value } : x)))} />
              <span className="text-zinc-400">kr / knife</span>
              <button className={`${btn} text-zinc-400 hover:bg-zinc-800`} onClick={() => setTiers((all) => all.filter((_, j) => j !== i))}>Remove</button>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <button className={`${btn} bg-zinc-800 hover:bg-zinc-700`} onClick={() => setTiers((all) => [...all, { minKnives: "", price: "" }])}>Add row</button>
          <button className={`${btn} bg-amber-500 hover:bg-amber-400 text-zinc-950`} disabled={busy}
            onClick={() => run(() => apiFetch(token, "/api/pricing/tiers", { method: "PUT", body: JSON.stringify(parsedTiers) }), "Prices saved.")}>Save prices</button>
        </div>
        <p className="text-xs text-zinc-500">
          Preview: {[1, 2, 3, 4, 5].map((n) => `${n} = ${formatKr(preview(parsedTiers, n, active?.firstKnifePriceOre))}`).join(" · ")}
          {active ? ` (incl. campaign "${active.name}")` : ""}
        </p>
      </div>

      <div className={card}>
        <div>
          <h2 className="font-semibold">Campaigns</h2>
          <p className="text-sm text-zinc-400">A campaign replaces the price of the first knife; the rest follow the price list. Only one campaign can be active.</p>
        </div>
        <ul className="divide-y divide-zinc-800 text-sm">
          {campaigns.length === 0 && <li className="py-2 text-zinc-500">No campaigns yet.</li>}
          {campaigns.map((c) => (
            <li key={c.id} className="py-2.5 flex flex-wrap items-center gap-3 justify-between">
              <div>
                <span className="font-medium">{c.name}</span>{" "}
                <span className="text-zinc-400">· first knife {formatKr(c.firstKnifePriceOre)} · {c.startsOn ?? "any start"} → {c.endsOn ?? "no end"}</span>
                {c.active && <span className="ml-2 px-2 py-0.5 rounded-full bg-emerald-900 text-emerald-200 text-xs">Active</span>}
              </div>
              <div className="flex gap-2">
                <button className={`${btn} bg-zinc-800 hover:bg-zinc-700`} disabled={busy}
                  onClick={() => run(() => apiFetch(token, `/api/pricing/campaigns/${c.id}`, { method: "PUT", body: JSON.stringify({ ...c, active: !c.active }) }), c.active ? "Campaign turned off." : "Campaign turned on.")}>
                  {c.active ? "Turn off" : "Turn on"}
                </button>
                <button className={`${btn} text-red-300 hover:bg-red-950`} disabled={busy}
                  onClick={() => confirm(`Delete "${c.name}"?`) && run(() => apiFetch(token, `/api/pricing/campaigns/${c.id}`, { method: "DELETE" }), "Campaign deleted.")}>Delete</button>
              </div>
            </li>
          ))}
        </ul>
        <form className="grid gap-2 sm:grid-cols-[1fr_auto_auto_auto_auto_auto] sm:items-center text-sm"
          onSubmit={(e) => {
            e.preventDefault();
            run(() => apiFetch(token, "/api/pricing/campaigns", { method: "POST", body: JSON.stringify({
              name: form.name, firstKnifePriceOre: toOre(form.price), startsOn: form.startsOn || null, endsOn: form.endsOn || null, active: form.active,
            }) }), "Campaign created.").then(() => setForm({ name: "", price: "", startsOn: "", endsOn: "", active: true }));
          }}>
          <input required placeholder="Name, e.g. Kom och testa" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={input} />
          <input required type="number" min={0} step="0.01" placeholder="First knife kr" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} className={`${input} w-32`} />
          <input type="date" aria-label="Start date" value={form.startsOn} onChange={(e) => setForm({ ...form, startsOn: e.target.value })} className={input} />
          <input type="date" aria-label="End date" value={form.endsOn} onChange={(e) => setForm({ ...form, endsOn: e.target.value })} className={input} />
          <label className="flex items-center gap-2 text-zinc-300"><input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} /> Active</label>
          <button type="submit" disabled={busy} className={`${btn} bg-amber-500 hover:bg-amber-400 text-zinc-950`}>Create</button>
        </form>
      </div>

      <div className={card}>
        <div>
          <h2 className="font-semibold">Payment methods</h2>
          <p className="text-sm text-zinc-400">Turned-off methods are hidden from the booking form and rejected if submitted.</p>
        </div>
        <ul className="divide-y divide-zinc-800 text-sm">
          {methods.map((m) => (
            <li key={m.code} className="py-2.5 flex items-center justify-between gap-3">
              <span>{m.label} <span className="text-zinc-500">· pay {m.timing === "before" ? "before" : "after"}</span></span>
              <button className={`${btn} ${m.active ? "bg-emerald-900 text-emerald-100" : "bg-zinc-800 text-zinc-400"}`} disabled={busy}
                onClick={() => run(() => apiFetch(token, `/api/payment-methods/${m.code}`, { method: "PATCH", body: JSON.stringify({ active: !m.active }) }), "Payment method updated.")}>
                {m.active ? "On" : "Off"}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
