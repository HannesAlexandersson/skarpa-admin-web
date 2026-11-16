"use client";

import { useCallback, useEffect, useState } from "react";

interface PickupBooking {
  id: string;
  pickupDate: string;
  pickupTime: string;
  pickupAddress: string;
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
}

interface Customer {
  id: string;
  name: string;
  address: string;
  phone: string;
  email?: string;
}

const getTodaySweden = () => new Date().toLocaleDateString("sv-SE");

export default function AdminPage() {
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState("");

  const [tab, setTab] = useState<"bookings" | "customers">("bookings");
  const [date, setDate] = useState<string>(getTodaySweden);
  const [bookings, setBookings] = useState<PickupBooking[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);

  const loadBookings = useCallback(async (selectedDate: string) => {
    setLoading(true);
    const res = await fetch(`/api/bookings?date=${selectedDate}`);
    if (res.status === 401) {
      setAuthed(false);
      setLoading(false);
      return;
    }
    setAuthed(true);
    setBookings(await res.json());
    setLoading(false);
  }, []);

  const loadCustomers = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/customers");
    if (res.status === 401) {
      setAuthed(false);
      setLoading(false);
      return;
    }
    setAuthed(true);
    setCustomers(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => {
    if (tab === "bookings") loadBookings(date);
    else loadCustomers();
  }, [tab, date, loadBookings, loadCustomers]);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setAuthError("");
    const res = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    if (!res.ok) {
      setAuthError("Wrong password");
      return;
    }
    setPassword("");
    loadBookings(date);
  }

  if (authed === false) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-zinc-950 text-zinc-100 p-4">
        <form onSubmit={handleLogin} className="w-full max-w-sm space-y-4 bg-zinc-900 p-6 rounded-2xl border border-zinc-800">
          <h1 className="text-xl font-semibold">Skärpa Admin</h1>
          <input
            type="password"
            placeholder="Admin password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-4 py-3 rounded-xl bg-zinc-800 border border-zinc-700 text-base"
          />
          {authError && <p className="text-red-400 text-sm">{authError}</p>}
          <button type="submit" className="w-full py-3 rounded-xl bg-amber-500 text-zinc-950 font-semibold">
            Log in
          </button>
        </form>
      </main>
    );
  }

  const filteredCustomers = customers.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.address.toLowerCase().includes(search.toLowerCase()) ||
      c.phone.includes(search)
  );

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100 p-4 max-w-xl mx-auto space-y-4">
      <header className="flex items-center justify-between pt-2">
        <h1 className="text-xl font-bold tracking-tight">Skärpa Admin</h1>
        <button
          onClick={() => (tab === "bookings" ? loadBookings(date) : loadCustomers())}
          className="px-3 py-1.5 text-sm rounded-lg bg-zinc-800 active:bg-zinc-700"
        >
          Refresh
        </button>
      </header>

      <div className="grid grid-cols-2 gap-2 bg-zinc-900 p-1 rounded-xl border border-zinc-800">
        <button
          onClick={() => setTab("bookings")}
          className={`py-2.5 rounded-lg text-sm font-medium ${tab === "bookings" ? "bg-amber-500 text-zinc-950" : "text-zinc-400"
            }`}
        >
          Pickups
        </button>
        <button
          onClick={() => setTab("customers")}
          className={`py-2.5 rounded-lg text-sm font-medium ${tab === "customers" ? "bg-amber-500 text-zinc-950" : "text-zinc-400"
            }`}
        >
          Customers
        </button>
      </div>

      {tab === "bookings" ? (
        <section className="space-y-3">
          <div className="flex gap-2">
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="flex-1 px-3 py-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-base"
            />
            <button
              onClick={() => setDate(getTodaySweden())}
              className="px-4 py-2.5 rounded-xl bg-zinc-800 text-sm font-medium"
            >
              Today
            </button>
          </div>

          {loading ? (
            <p className="text-zinc-400 text-sm py-8 text-center">Loading pickups...</p>
          ) : bookings.length === 0 ? (
            <p className="text-zinc-400 text-sm py-8 text-center bg-zinc-900 rounded-2xl border border-zinc-800">
              No pickups scheduled for {date}.
            </p>
          ) : (
            <ul className="space-y-3">
              {bookings.map((b) => (
                <li key={b.id} className="p-4 rounded-2xl bg-zinc-900 border border-zinc-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-lg font-bold text-amber-400">{b.pickupTime.slice(0, 5)}</span>
                    <span className="font-semibold">{b.customerName}</span>
                  </div>
                  <a
                    href={`https://maps.google.com/?q=${encodeURIComponent(b.pickupAddress)}`}
                    target="_blank"
                    rel="noreferrer"
                    className="block text-sm text-zinc-300 underline"
                  >
                    {b.pickupAddress}
                  </a>
                  <a href={`tel:${b.customerPhone}`} className="inline-block text-sm text-amber-400 font-medium">
                    {b.customerPhone}
                  </a>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : (
        <section className="space-y-3">
          <input
            type="search"
            placeholder="Search name, address, or phone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full px-4 py-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-base"
          />

          {loading ? (
            <p className="text-zinc-400 text-sm py-8 text-center">Loading customers...</p>
          ) : (
            <ul className="space-y-2">
              {filteredCustomers.map((c) => (
                <li key={c.id} className="p-4 rounded-2xl bg-zinc-900 border border-zinc-800 space-y-1">
                  <p className="font-semibold">{c.name}</p>
                  <p className="text-sm text-zinc-400">{c.address}</p>
                  <div className="flex gap-4 pt-1 text-sm">
                    <a href={`tel:${c.phone}`} className="text-amber-400">
                      {c.phone}
                    </a>
                    {c.email && <span className="text-zinc-400">{c.email}</span>}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </main>
  );
}