import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function GET() {
    const cookieStore = await cookies();
    const session = cookieStore.get("skarpa_admin")?.value;

    if (session !== process.env.ADMIN_API_KEY) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const res = await fetch(`${process.env.CLOUD_RUN_URL}/api/customers`, {
        headers: { "X-Api-Key": process.env.ADMIN_API_KEY! },
        cache: "no-store",
    });

    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
}