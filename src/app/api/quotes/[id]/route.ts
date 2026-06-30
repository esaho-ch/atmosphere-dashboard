import { NextResponse } from "next/server";
import { fetchContact, fetchQuotes, calculateMargins, getMaterialCostForQuote } from "@/lib/bexio";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const quoteId = parseInt(id);
    const [allQuotes, { positions, materialCost }] = await Promise.all([
      fetchQuotes(),
      getMaterialCostForQuote(quoteId),
    ]);

    const quote = allQuotes.find((q) => q.id === quoteId);
    if (!quote) return NextResponse.json({ error: "Not found" }, { status: 404 });

    let contactName = "";
    try {
      const contact = await fetchContact(quote.contact_id);
      contactName = [contact.name_1, contact.name_2].filter(Boolean).join(" ");
    } catch {}

    const totalHT = parseFloat(quote.total_net) || 0;
    const margins = calculateMargins(totalHT, materialCost);

    return NextResponse.json({ ...quote, contact_name: contactName, positions, margins });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
