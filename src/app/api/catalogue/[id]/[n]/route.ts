import { NextResponse } from "next/server";
import { catalogueImage } from "@/lib/catalogue";

export async function GET(req: Request, { params }: { params: Promise<{ id: string; n: string }> }) {
  const { id, n } = await params;
  const face = parseInt(n);
  if (!Number.isInteger(face) || face < 0) return new NextResponse("Not found", { status: 404 });
  try {
    const img = await catalogueImage(decodeURIComponent(id), face);
    if (!img) return new NextResponse("Not found", { status: 404 });
    // ?w=160 → small thumbnail for the tile list (resized from the cached web-sized JPEG)
    const w = parseInt(new URL(req.url).searchParams.get("w") ?? "");
    const body = w > 0 && w <= 800
      ? await (await import("sharp")).default(img).resize(w, w, { fit: "cover" }).jpeg({ quality: 78 }).toBuffer()
      : img;
    return new NextResponse(new Uint8Array(body), {
      headers: { "Content-Type": "image/jpeg", "Cache-Control": "private, max-age=3600" },
    });
  } catch {
    return new NextResponse("Conversion failed", { status: 500 });
  }
}
