import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
    const cookieStore = await cookies();
    const session = cookieStore.get("skarpa_admin")?.value;

    if (session !== process.env.ADMIN_API_KEY) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const date = searchParams.get("date");
    const targetUrl = new URL(`${process.env.CLOUD_RUN_URL}/api/bookings`);
    if (date) targetUrl.searchParams.set("date", date);

    const res = await fetch(targetUrl.toString(), {
        headers: { "X-Api-Key": process.env.ADMIN_API_KEY! },
        cache: "no-store",
    });

    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
}