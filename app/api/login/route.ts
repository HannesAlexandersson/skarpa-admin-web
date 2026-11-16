import { NextResponse } from "next/server";

export async function POST(request: Request) {
    const { password } = await request.json();

    if (!password || password !== process.env.ADMIN_API_KEY) {
        return NextResponse.json({ error: "Invalid password" }, { status: 401 });
    }

    const response = NextResponse.json({ ok: true });
    response.cookies.set("skarpa_admin", password, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60 * 24 * 30,
    });

    return response;
}