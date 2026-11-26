"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { apiFetch, formatKr, PAYMENT_STATUSES } from "@/lib/api";

interface BookingPhoto {
    id: string;
    bookingId: string;
    url: string;
    note?: string | null;
    createdAt: string;
}

interface BookingDetail {
    id: string;
    pickupDate: string;
    pickupTime: string;
    pickupAddress: string;
    customerId: string;
    customerName: string;
    customerPhone: string;
    customerEmail?: string | null;
    knifeCount: number;
    paymentId?: string | null;
    paymentMethod?: string | null;
    paymentStatus?: string | null;
    amountOre?: number | null;
    withdrawalConsentAt?: string | null;
    withdrawalConsentText?: string | null;
    withdrawalConsentVersion?: string | null;
    photos: BookingPhoto[];
}

async function compressImage(file: File, maxDimension = 1600, quality = 0.82): Promise<Blob> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        const objectUrl = URL.createObjectURL(file);

        img.onload = () => {
            URL.revokeObjectURL(objectUrl);
            let { width, height } = img;

            if (width > maxDimension || height > maxDimension) {
                if (width >= height) {
                    height = Math.round((height * maxDimension) / width);
                    width = maxDimension;
                } else {
                    width = Math.round((width * maxDimension) / height);
                    height = maxDimension;
                }
            }

            const canvas = document.createElement("canvas");
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext("2d");
            if (!ctx) {
                reject(new Error("Could not initialize image canvas"));
                return;
            }

            ctx.drawImage(img, 0, 0, width, height);
            canvas.toBlob(
                (blob) => {
                    if (!blob) {
                        reject(new Error("Image compression failed"));
                        return;
                    }
                    resolve(blob);
                },
                "image/jpeg",
                quality
            );
        };

        img.onerror = () => {
            URL.revokeObjectURL(objectUrl);
            reject(new Error("Could not read selected image"));
        };

        img.src = objectUrl;
    });
}

export default function BookingDetailPage() {
    const { id } = useParams<{ id: string }>();
    const router = useRouter();

    const [session, setSession] = useState<Session | null>(null);
    const [authReady, setAuthReady] = useState(false);

    const [booking, setBooking] = useState<BookingDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    const [note, setNote] = useState("");
    const [uploading, setUploading] = useState(false);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [previewPhoto, setPreviewPhoto] = useState<BookingPhoto | null>(null);

    const cameraInputRef = useRef<HTMLInputElement>(null);
    const galleryInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        supabase.auth.getSession().then(({ data }) => {
            if (!data.session) {
                router.replace("/");
                return;
            }
            setSession(data.session);
            setAuthReady(true);
        });

        const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
            if (!newSession) router.replace("/");
            else setSession(newSession);
        });

        return () => listener.subscription.unsubscribe();
    }, [router]);

    const loadBooking = useCallback(async () => {
        if (!session || !id) return;
        setLoading(true);
        setError("");
        try {
            const data = await apiFetch<BookingDetail>(session.access_token, `/api/bookings/${id}`);
            setBooking(data);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to load booking");
        } finally {
            setLoading(false);
        }
    }, [session, id]);

    useEffect(() => {
        if (session) loadBooking();
    }, [session, loadBooking]);

    async function handlePaymentStatusChange(status: string) {
        if (!session || !booking?.paymentId) return;
        setError("");
        try {
            await apiFetch(session.access_token, `/api/payments/${booking.paymentId}`, {
                method: "PATCH",
                body: JSON.stringify({ status }),
            });
            setBooking((prev) => (prev ? { ...prev, paymentStatus: status } : prev));
        } catch (err) {
            setError(err instanceof Error ? err.message : "Could not update payment");
        }
    }

    async function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        e.target.value = "";
        if (!file || !session || !id) return;

        setUploading(true);
        setError("");
        try {
            const compressed = await compressImage(file);
            const formData = new FormData();
            formData.append("file", compressed, "pickup.jpg");
            if (note.trim()) formData.append("note", note.trim());

            const created = await apiFetch<BookingPhoto>(session.access_token, `/api/bookings/${id}/photos`, {
                method: "POST",
                body: formData,
            });

            setBooking((prev) => (prev ? { ...prev, photos: [created, ...prev.photos] } : prev));
            setNote("");
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to upload photo");
        } finally {
            setUploading(false);
        }
    }

    async function handleDeletePhoto(photoId: string) {
        if (!session || !id) return;
        if (!window.confirm("Delete this pickup photo?")) return;

        setDeletingId(photoId);
        setError("");
        try {
            await apiFetch<void>(session.access_token, `/api/bookings/${id}/photos/${photoId}`, {
                method: "DELETE",
            });
            setBooking((prev) =>
                prev ? { ...prev, photos: prev.photos.filter((p) => p.id !== photoId) } : prev
            );
            if (previewPhoto?.id === photoId) setPreviewPhoto(null);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to delete photo");
        } finally {
            setDeletingId(null);
        }
    }

    if (!authReady || !session) return null;

    return (
        <div className="min-h-screen bg-zinc-950 text-zinc-100">
            <header className="border-b border-zinc-800 bg-zinc-900/70 backdrop-blur sticky top-0 z-10">
                <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
                    <button
                        onClick={() => router.push("/")}
                        className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-sm font-medium transition"
                    >
                        ← Back to Pickups
                    </button>
                    <span className="text-sm font-semibold text-zinc-300">Booking Details</span>
                    <button
                        onClick={loadBooking}
                        className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-sm transition"
                    >
                        Refresh
                    </button>
                </div>
            </header>

            <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
                {error && (
                    <div className="p-4 rounded-xl bg-red-950/60 border border-red-800 text-red-200 text-sm">
                        {error}
                    </div>
                )}

                {loading ? (
                    <p className="text-zinc-400 text-sm py-12 text-center">Loading booking...</p>
                ) : !booking ? (
                    <div className="p-8 rounded-2xl bg-zinc-900 border border-zinc-800 text-center text-zinc-400">
                        Booking not found.
                    </div>
                ) : (
                    <>
                        {/* Customer, Pickup & Payment Summary */}
                        <section className="p-5 sm:p-6 rounded-2xl bg-zinc-900 border border-zinc-800 space-y-5">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-zinc-800 pb-4">
                                <div>
                                    <p className="text-xs uppercase tracking-wider text-zinc-400">Pickup Slot</p>
                                    <p className="text-xl font-bold text-amber-400">
                                        {booking.pickupDate} · {booking.pickupTime.slice(0, 5)}
                                    </p>
                                </div>
                                <div className="sm:text-right">
                                    <p className="text-xs uppercase tracking-wider text-zinc-400">Customer</p>
                                    <p className="text-lg font-semibold">{booking.customerName}</p>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
                                <div>
                                    <p className="text-zinc-400 text-xs mb-1">Address</p>
                                    <a
                                        href={`https://maps.google.com/?q=${encodeURIComponent(booking.pickupAddress)}`}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="text-zinc-100 hover:text-amber-400 underline underline-offset-2"
                                    >
                                        {booking.pickupAddress}
                                    </a>
                                </div>
                                <div>
                                    <p className="text-zinc-400 text-xs mb-1">Phone</p>
                                    <a href={`tel:${booking.customerPhone}`} className="text-amber-400 font-medium hover:underline">
                                        {booking.customerPhone}
                                    </a>
                                </div>
                                <div>
                                    <p className="text-zinc-400 text-xs mb-1">Email</p>
                                    {booking.customerEmail ? (
                                        <a href={`mailto:${booking.customerEmail}`} className="text-zinc-200 hover:underline">
                                            {booking.customerEmail}
                                        </a>
                                    ) : (
                                        <span className="text-zinc-500">—</span>
                                    )}
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t border-zinc-800 text-sm">
                                <div>
                                    <p className="text-zinc-400 text-xs mb-1">Knives & Price</p>
                                    <p className="font-medium">
                                        {booking.knifeCount} {booking.knifeCount === 1 ? "knife" : "knives"} ·{" "}
                                        <span className="text-amber-400">{formatKr(booking.amountOre)}</span>
                                    </p>
                                </div>
                                <div>
                                    <p className="text-zinc-400 text-xs mb-1">Payment</p>
                                    <div className="flex items-center gap-2">
                                        <span className="text-zinc-300">{booking.paymentMethod ?? "—"}</span>
                                        {booking.paymentId ? (
                                            <select
                                                aria-label="Payment status"
                                                value={booking.paymentStatus ?? "pending"}
                                                onChange={(e) => handlePaymentStatusChange(e.target.value)}
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
                                        )}
                                    </div>
                                </div>
                                <div>
                                    <p className="text-zinc-400 text-xs mb-1">Withdrawal Consent</p>
                                    {booking.withdrawalConsentAt ? (
                                        <p className="text-xs text-zinc-300">
                                            Accepted {new Date(booking.withdrawalConsentAt).toLocaleString("sv-SE")}
                                            {booking.withdrawalConsentVersion ? ` (${booking.withdrawalConsentVersion})` : ""}
                                        </p>
                                    ) : (
                                        <span className="text-zinc-500 text-xs">Not recorded</span>
                                    )}
                                </div>
                            </div>
                        </section>

                        {/* Capture / Upload Photo Section */}
                        <section className="p-5 sm:p-6 rounded-2xl bg-zinc-900 border border-zinc-800 space-y-4">
                            <div>
                                <h2 className="text-lg font-semibold">Pickup Insurance Photos</h2>
                                <p className="text-sm text-zinc-400">
                                    Photograph the knives at pickup to document condition and count.
                                </p>
                            </div>

                            <input
                                type="text"
                                placeholder="Optional note (e.g., 4 knives, chipped tip on chef knife)..."
                                value={note}
                                onChange={(e) => setNote(e.target.value)}
                                disabled={uploading}
                                className="w-full px-4 py-2.5 rounded-xl bg-zinc-950 border border-zinc-700 text-sm sm:text-base"
                            />

                            <input
                                ref={cameraInputRef}
                                type="file"
                                accept="image/*"
                                capture="environment"
                                onChange={handleFileSelected}
                                className="hidden"
                            />
                            <input
                                ref={galleryInputRef}
                                type="file"
                                accept="image/*"
                                onChange={handleFileSelected}
                                className="hidden"
                            />

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <button
                                    type="button"
                                    disabled={uploading}
                                    onClick={() => cameraInputRef.current?.click()}
                                    className="py-3 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-semibold transition disabled:opacity-50"
                                >
                                    {uploading ? "Uploading photo..." : "Take Photo with Camera"}
                                </button>
                                <button
                                    type="button"
                                    disabled={uploading}
                                    onClick={() => galleryInputRef.current?.click()}
                                    className="py-3 px-4 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-100 font-medium transition disabled:opacity-50"
                                >
                                    Choose from Gallery
                                </button>
                            </div>
                        </section>

                        {/* Attached Photos Gallery */}
                        <section className="space-y-3">
                            <h3 className="text-base font-semibold">
                                Attached Photos ({booking.photos.length})
                            </h3>

                            {booking.photos.length === 0 ? (
                                <div className="p-8 rounded-2xl bg-zinc-900 border border-zinc-800 text-center text-sm text-zinc-400">
                                    No photos attached to this booking yet.
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {booking.photos.map((photo) => (
                                        <div
                                            key={photo.id}
                                            className="rounded-2xl bg-zinc-900 border border-zinc-800 overflow-hidden flex flex-col"
                                        >
                                            <button
                                                type="button"
                                                onClick={() => setPreviewPhoto(photo)}
                                                className="aspect-[4/3] w-full bg-zinc-950 overflow-hidden block"
                                            >
                                                {photo.url ? (
                                                    <img
                                                        src={photo.url}
                                                        alt={photo.note ?? "Pickup knife photo"}
                                                        className="w-full h-full object-cover hover:scale-105 transition duration-200"
                                                    />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center text-xs text-zinc-500">
                                                        Image unavailable
                                                    </div>
                                                )}
                                            </button>

                                            <div className="p-3.5 flex-1 flex flex-col justify-between gap-3">
                                                <div className="space-y-1">
                                                    <p className="text-xs text-zinc-400">
                                                        {new Date(photo.createdAt).toLocaleString("sv-SE", {
                                                            year: "numeric",
                                                            month: "2-digit",
                                                            day: "2-digit",
                                                            hour: "2-digit",
                                                            minute: "2-digit",
                                                        })}
                                                    </p>
                                                    {photo.note && <p className="text-sm text-zinc-200">{photo.note}</p>}
                                                </div>

                                                <button
                                                    type="button"
                                                    disabled={deletingId === photo.id}
                                                    onClick={() => handleDeletePhoto(photo.id)}
                                                    className="self-start text-xs text-red-400 hover:text-red-300 disabled:opacity-50"
                                                >
                                                    {deletingId === photo.id ? "Deleting..." : "Delete photo"}
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </section>
                    </>
                )}
            </main>

            {/* Fullscreen Image Lightbox */}
            {previewPhoto && previewPhoto.url && (
                <div
                    onClick={() => setPreviewPhoto(null)}
                    className="fixed inset-0 z-50 bg-black/90 p-4 flex flex-col items-center justify-center gap-4"
                >
                    <img
                        src={previewPhoto.url}
                        alt={previewPhoto.note ?? "Full size pickup photo"}
                        className="max-h-[80vh] max-w-full rounded-xl object-contain"
                    />
                    {previewPhoto.note && (
                        <p className="text-sm text-zinc-200 bg-zinc-900/90 px-4 py-2 rounded-xl border border-zinc-800">
                            {previewPhoto.note}
                        </p>
                    )}
                    <button
                        type="button"
                        onClick={() => setPreviewPhoto(null)}
                        className="px-5 py-2 rounded-xl bg-zinc-800 text-sm font-medium"
                    >
                        Close
                    </button>
                </div>
            )}
        </div>
    );
}