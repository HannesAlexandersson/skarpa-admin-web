"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { apiFetch, formatKr, PAYMENT_STATUSES } from "@/lib/api";
import PricingPanel from "@/components/PricingPanel";
import HoursPanel from "@/components/HoursPanel";

interface PickupBooking {
  id: string;
  pickupDate: string;
  pickupTime: string;
  pickupAddress: string;
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  knifeCount: number;
  paymentId?: string | null;
  paymentMethod?: string | null;
  paymentStatus?: string | null;
  amountOre?: number | null;
}

interface Customer {
  id: string;
  name: string;
  address: string;
  phone: string;
  email?: string;
  createdAt: string;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL!;
const getTodaySweden = () => new Date().toLocaleDateString("sv-SE");

function shiftDate(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return dt.toISOString().slice(0, 10);
}

export default function AdminPage() {
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [signingIn, setSigningIn] = useState(false);

  const [tab, setTab] = useState<"bookings" | "customers" | "pricing" | "hours">("bookings");
  const [date, setDate] = useState<string>("");
  const [bookings, setBookings] = useState<PickupBooking[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setDate(getTodaySweden());
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setAuthReady(true);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  const fetchWithAuth = useCallback(
    async (path: string) => {
      if (!session) return null;
      const res = await fetch(`${API_URL}${path}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (!res.ok) {
        throw new Error(`API error (${res.status})`);
      }
      return res.json();
    },
    [session]
  );

  const loadData = useCallback(async () => {
    if (!session) return;
    if (tab === "pricing" || tab === "hours") return;
    if (tab === "bookings" && !date) return;
    setLoading(true);
    setError("");
    try {
      if (tab === "bookings") {
        const data = await fetchWithAuth(`/api/bookings?date=${date}`);
        if (data) setBookings(data);
      } else {
        const data = await fetchWithAuth("/api/customers");
        if (data) setCustomers(data);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load data");
    } finally {
      setLoading(false);
    }
  }, [session, tab, date, fetchWithAuth]);

  useEffect(() => {
    if (session) loadData();
  }, [session, loadData]);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setAuthError("");
    setSigningIn(true);
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    setSigningIn(false);
    if (signInError) setAuthError(signInError.message);
  }

  async function setPaymentStatus(paymentId: string, status: string) {
    if (!session) return;
    setError("");
    try {
      await apiFetch(session.access_token, `/api/payments/${paymentId}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      setBookings((all) => all.map((b) => (b.paymentId === paymentId ? { ...b, paymentStatus: status } : b)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update payment");
    }
  }

  const statusSelect = (b: PickupBooking) =>
    b.paymentId ? (
      <select
        aria-label="Payment status"
        value={b.paymentStatus ?? "pending"}
        onClick={(e) => e.stopPropagation()}
        onChange={(e) => {
          e.stopPropagation();
          setPaymentStatus(b.paymentId!, e.target.value);
        }}
        className="px-2 py-1 rounded-lg bg-zinc-950 border border-zinc-700 text-xs"
      >
        {PAYMENT_STATUSES.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>
    ) : (
      <span className="text-zinc-500 text-xs">No payment</span>
    );

  const TABS = [
    { id: "bookings", label: "Pickups" },
    { id: "customers", label: "Customers" },
    { id: "pricing", label: "Prices" },
    { id: "hours", label: "Hours" },
  ] as const;

  if (!authReady) return null;

  if (!session) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-zinc-950 text-zinc-100 p-4">
        <form
          onSubmit={handleLogin}
          className="w-full max-w-sm space-y-4 bg-zinc-900 p-6 sm:p-8 rounded-2xl border border-zinc-800 shadow-xl"
        >
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Skärpa Admin</h1>
            <p className="text-sm text-zinc-400 mt-1">Sign in with your Supabase account</p>
          </div>
          <input
            type="email"
            required
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-4 py-3 rounded-xl bg-zinc-800 border border-zinc-700 text-base"
          />
          <input
            type="password"
            required
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-4 py-3 rounded-xl bg-zinc-800 border border-zinc-700 text-base"
          />
          {authError && <p className="text-red-400 text-sm">{authError}</p>}
          <button
            type="submit"
            disabled={signingIn}
            className="w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-semibold transition disabled:opacity-50"
          >
            {signingIn ? "Signing in..." : "Sign in"}
          </button>
        </form>
      </main>
    );
  }

  const filteredCustomers = customers.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.address.toLowerCase().includes(search.toLowerCase()) ||
      c.phone.includes(search) ||
      (c.email ?? "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      {/* Top Navigation Bar */}
      <header className="border-b border-zinc-800 bg-zinc-900/70 backdrop-blur sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-6">
            <h1 className="text-lg sm:text-xl font-bold tracking-tight">Skärpa Admin</h1>
            <nav className="hidden sm:flex gap-1 bg-zinc-950 p-1 rounded-xl border border-zinc-800">
              {TABS.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={`px-4 py-1.5 rounded-lg text-sm font-medium transition ${tab === t.id ? "bg-amber-500 text-zinc-950" : "text-zinc-400 hover:text-zinc-200"
                    }`}
                >
                  {t.label}
                </button>
              ))}
            </nav>
          </div>

          <div className="flex items-center gap-3">
            <span className="hidden md:inline text-xs text-zinc-400">{session.user.email}</span>
            <button
              onClick={loadData}
              className="px-3 py-1.5 text-sm rounded-lg bg-zinc-800 hover:bg-zinc-700 transition"
            >
              Refresh
            </button>
            <button
              onClick={() => supabase.auth.signOut()}
              className="px-3 py-1.5 text-sm rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition"
            >
              Sign out
            </button>
          </div>
        </div>

        {/* Mobile Tab Bar */}
        <div className="sm:hidden px-4 pb-3">
          <div className="grid grid-cols-4 gap-1 bg-zinc-950 p-1 rounded-xl border border-zinc-800">
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`py-2 rounded-lg text-sm font-medium ${tab === t.id ? "bg-amber-500 text-zinc-950" : "text-zinc-400"
                  }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {error && (
          <div className="p-4 rounded-xl bg-red-950/60 border border-red-800 text-red-200 text-sm">
            {error}
          </div>
        )}

        {tab === "pricing" ? (
          <PricingPanel token={session.access_token} />
        ) : tab === "hours" ? (
          <HoursPanel token={session.access_token} />
        ) : tab === "bookings" ? (
          <section className="space-y-4">
            {/* Controls & Summary */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-zinc-900 p-4 rounded-2xl border border-zinc-800">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => date && setDate((d) => shiftDate(d, -1))}
                  aria-label="Previous day"
                  className="px-3 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-sm font-medium"
                >
                  ←
                </button>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-700 text-sm sm:text-base"
                />
                <button
                  onClick={() => date && setDate((d) => shiftDate(d, 1))}
                  aria-label="Next day"
                  className="px-3 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-sm font-medium"
                >
                  →
                </button>
                <button
                  onClick={() => setDate(getTodaySweden())}
                  className="px-3.5 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-sm font-medium"
                >
                  Today
                </button>
              </div>

              <div className="text-sm text-zinc-400">
                <span className="font-semibold text-zinc-100">{bookings.length}</span>{" "}
                {bookings.length === 1 ? "pickup" : "pickups"} scheduled
              </div>
            </div>

            {loading ? (
              <p className="text-zinc-400 text-sm py-12 text-center">Loading pickups...</p>
            ) : bookings.length === 0 ? (
              <div className="text-zinc-400 text-sm py-12 text-center bg-zinc-900 rounded-2xl border border-zinc-800">
                No pickups scheduled for {date}.
              </div>
            ) : (
              <>
                {/* Mobile Card List */}
                <ul className="md:hidden space-y-3">
                  {bookings.map((b) => (
                    <li
                      key={b.id}
                      onClick={() => router.push(`/bookings/${b.id}`)}
                      className="p-4 rounded-2xl bg-zinc-900 border border-zinc-800 active:border-amber-500/60 cursor-pointer space-y-2.5 transition"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-lg font-bold text-amber-400">{b.pickupTime.slice(0, 5)}</span>
                        <span className="font-semibold">{b.customerName}</span>
                      </div>
                      <a
                        href={`https://maps.google.com/?q=${encodeURIComponent(b.pickupAddress)}`}
                        target="_blank"
                        rel="noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="block text-sm text-zinc-300 underline"
                      >
                        {b.pickupAddress}
                      </a>
                      <div className="flex gap-4 pt-1">
                        <a
                          href={`tel:${b.customerPhone}`}
                          onClick={(e) => e.stopPropagation()}
                          className="text-sm text-amber-400 font-medium"
                        >
                          {b.customerPhone}
                        </a>
                        {b.customerEmail && (
                          <a
                            href={`mailto:${b.customerEmail}`}
                            onClick={(e) => e.stopPropagation()}
                            className="text-sm text-zinc-400"
                          >
                            {b.customerEmail}
                          </a>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-3 pt-1 text-sm text-zinc-300">
                        <span>
                          {b.knifeCount} {b.knifeCount === 1 ? "knife" : "knives"}
                        </span>
                        <span>{formatKr(b.amountOre)}</span>
                        <span className="text-zinc-400">{b.paymentMethod ?? "—"}</span>
                        {statusSelect(b)}
                      </div>
                      <div className="pt-2 border-t border-zinc-800/80 flex items-center justify-between text-xs text-amber-400 font-medium">
                        <span>Open booking & pickup photos</span>
                        <span>→</span>
                      </div>
                    </li>
                  ))}
                </ul>

                {/* Desktop Table */}
                <div className="hidden md:block overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-zinc-800 text-xs uppercase tracking-wider text-zinc-400 bg-zinc-900/80">
                        <th className="py-3.5 px-5">Time</th>
                        <th className="py-3.5 px-5">Customer</th>
                        <th className="py-3.5 px-5">Pickup Address</th>
                        <th className="py-3.5 px-5">Phone</th>
                        <th className="py-3.5 px-5">Email</th>
                        <th className="py-3.5 px-5">Knives</th>
                        <th className="py-3.5 px-5">Price</th>
                        <th className="py-3.5 px-5">Payment</th>
                        <th className="py-3.5 px-5 text-right">Details</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800 text-sm">
                      {bookings.map((b) => (
                        <tr
                          key={b.id}
                          onClick={() => router.push(`/bookings/${b.id}`)}
                          className="hover:bg-zinc-800/60 cursor-pointer transition"
                        >
                          <td className="py-4 px-5 font-bold text-amber-400 whitespace-nowrap">
                            {b.pickupTime.slice(0, 5)}
                          </td>
                          <td className="py-4 px-5 font-medium">{b.customerName}</td>
                          <td className="py-4 px-5">
                            <a
                              href={`https://maps.google.com/?q=${encodeURIComponent(b.pickupAddress)}`}
                              target="_blank"
                              rel="noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="text-zinc-200 hover:text-amber-400 underline underline-offset-2"
                            >
                              {b.pickupAddress}
                            </a>
                          </td>
                          <td className="py-4 px-5 whitespace-nowrap">
                            <a
                              href={`tel:${b.customerPhone}`}
                              onClick={(e) => e.stopPropagation()}
                              className="text-amber-400 hover:underline"
                            >
                              {b.customerPhone}
                            </a>
                          </td>
                          <td className="py-4 px-5 text-zinc-400">{b.customerEmail ?? "—"}</td>
                          <td className="py-4 px-5">{b.knifeCount}</td>
                          <td className="py-4 px-5 whitespace-nowrap">{formatKr(b.amountOre)}</td>
                          <td className="py-4 px-5 space-y-1">
                            <div className="text-zinc-400 text-xs">{b.paymentMethod ?? "—"}</div>
                            {statusSelect(b)}
                          </td>
                          <td className="py-4 px-5 text-right text-amber-400 font-medium whitespace-nowrap">
                            Photos →
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </section>
        ) : (
          <section className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-zinc-900 p-4 rounded-2xl border border-zinc-800">
              <input
                type="search"
                placeholder="Search by name, address, phone, or email..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full sm:max-w-md px-4 py-2 rounded-xl bg-zinc-950 border border-zinc-700 text-sm sm:text-base"
              />
              <div className="text-sm text-zinc-400">
                Showing <span className="font-semibold text-zinc-100">{filteredCustomers.length}</span> of{" "}
                {customers.length} customers
              </div>
            </div>

            {loading ? (
              <p className="text-zinc-400 text-sm py-12 text-center">Loading customers...</p>
            ) : (
              <>
                {/* Mobile Card List */}
                <ul className="md:hidden space-y-3">
                  {filteredCustomers.map((c) => (
                    <li key={c.id} className="p-4 rounded-2xl bg-zinc-900 border border-zinc-800 space-y-1.5">
                      <p className="font-semibold">{c.name}</p>
                      <a
                        href={`https://maps.google.com/?q=${encodeURIComponent(c.address)}`}
                        target="_blank"
                        rel="noreferrer"
                        className="block text-sm text-zinc-300 underline"
                      >
                        {c.address}
                      </a>
                      <div className="flex gap-4 pt-1 text-sm">
                        <a href={`tel:${c.phone}`} className="text-amber-400 font-medium">
                          {c.phone}
                        </a>
                        {c.email && <span className="text-zinc-400">{c.email}</span>}
                      </div>
                    </li>
                  ))}
                </ul>

                {/* Desktop Table */}
                <div className="hidden md:block overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-zinc-800 text-xs uppercase tracking-wider text-zinc-400 bg-zinc-900/80">
                        <th className="py-3.5 px-5">Name</th>
                        <th className="py-3.5 px-5">Address</th>
                        <th className="py-3.5 px-5">Phone</th>
                        <th className="py-3.5 px-5">Email</th>
                        <th className="py-3.5 px-5">Added</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800 text-sm">
                      {filteredCustomers.map((c) => (
                        <tr key={c.id} className="hover:bg-zinc-800/50 transition">
                          <td className="py-4 px-5 font-medium">{c.name}</td>
                          <td className="py-4 px-5">
                            <a
                              href={`https://maps.google.com/?q=${encodeURIComponent(c.address)}`}
                              target="_blank"
                              rel="noreferrer"
                              className="text-zinc-200 hover:text-amber-400 underline underline-offset-2"
                            >
                              {c.address}
                            </a>
                          </td>
                          <td className="py-4 px-5 whitespace-nowrap">
                            <a href={`tel:${c.phone}`} className="text-amber-400 hover:underline">
                              {c.phone}
                            </a>
                          </td>
                          <td className="py-4 px-5 text-zinc-400">{c.email ?? "—"}</td>
                          <td className="py-4 px-5 text-zinc-400 whitespace-nowrap">
                            {new Date(c.createdAt).toLocaleDateString("sv-SE")}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </section>
        )}
      </main>
    </div>
  );
}