"use server";

import { revalidatePath } from "next/cache";
import { fetchArticles } from "@/lib/bexio";
import { assertWritable, fetchImageFromUrl, importLocalSources, removeTexture, saveManualTexture, syncTextures } from "@/lib/textures";

export async function fetchMissingTextures(formData: FormData) {
  assertWritable();
  const retryNotFound = formData.get("retry") === "1";
  const articles = await fetchArticles();
  await syncTextures(articles, { retryNotFound });
  revalidatePath("/products");
}

/** Texture from a pasted product-page / image URL, or an uploaded image file. */
export async function setManualTexture(formData: FormData) {
  assertWritable();
  const articleId = parseInt(String(formData.get("articleId")));
  const allSizes = formData.get("allSizes") === "on";
  const url = String(formData.get("url") ?? "").trim();
  const file = formData.get("file");

  let buffer: Buffer;
  let sourceUrl: string | undefined;
  if (file instanceof File && file.size > 0) {
    if (!file.type.startsWith("image/")) throw new Error("Le fichier doit être une image");
    if (file.size > 15 * 1024 * 1024) throw new Error("Image trop lourde (15 Mo max)");
    buffer = Buffer.from(await file.arrayBuffer());
  } else if (url) {
    const r = await fetchImageFromUrl(url);
    buffer = r.buffer;
    sourceUrl = r.imageUrl;
  } else {
    return;
  }

  const articles = await fetchArticles();
  saveManualTexture(articles, articleId, buffer, { allSizes, sourceUrl });
  revalidatePath("/products");
}

export async function clearTexture(formData: FormData) {
  assertWritable();
  removeTexture(parseInt(String(formData.get("articleId"))));
  revalidatePath("/products");
}

export async function importLocalFiles() {
  assertWritable();
  const articles = await fetchArticles();
  await importLocalSources(articles);
  revalidatePath("/products");
}
