import fs from "fs";
import { NextResponse } from "next/server";
import { textureFilePath } from "@/lib/textures";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const articleId = parseInt(id);
  if (!Number.isInteger(articleId)) return new NextResponse("Not found", { status: 404 });
  try {
    const file = fs.readFileSync(textureFilePath(articleId));
    const type = file[0] === 0x89 ? "image/png" : file.subarray(8, 12).toString() === "WEBP" ? "image/webp" : "image/jpeg";
    return new NextResponse(new Uint8Array(file), {
      headers: { "Content-Type": type, "Cache-Control": "private, no-cache" },
    });
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }
}
