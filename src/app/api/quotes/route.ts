import { NextResponse } from "next/server";
import { fetchQuotes, fetchContact } from "@/lib/bexio";

export async function GET() {
  try {
    const quotes = await fetchQuotes();

    const enriched = await Promise.all(
      quotes.map(async (q) => {
        let contactName = "";
        try {
          const contact = await fetchContact(q.contact_id);
          contactName = [contact.name_1, contact.name_2].filter(Boolean).join(" ");
        } catch {}

        return {
          ...q,
          contact_name: contactName,
          totalHT: parseFloat(q.total_net) || 0,
          totalTTC: parseFloat(q.total) || 0,
        };
      })
    );

    return NextResponse.json(enriched);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
