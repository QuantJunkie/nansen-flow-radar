import { NextResponse } from "next/server";
import { fetchSignals } from "@/lib/nansen";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  if (!process.env.NANSEN_API_KEY) {
    return NextResponse.json({ error: "NANSEN_API_KEY not configured" }, { status: 503 });
  }

  try {
    const data = await fetchSignals();
    return NextResponse.json(data, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (err) {
    console.error("Signals fetch error:", err);
    return NextResponse.json({ error: "Failed to fetch signals" }, { status: 500 });
  }
}
