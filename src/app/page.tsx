import { fetchQuotesPage, fetchContact, getMaterialCostForQuote, calculateMargins } from "@/lib/bexio";
import { verifySession } from "@/lib/session";
import { cookies } from "next/headers";
import { LogOut, BarChart2, Settings } from "lucide-react";
import Link from "next/link";
import QuoteRow from "@/components/QuoteRow";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

const PAGE_SIZE = 25;
const CURRENT_YEAR = new Date().getFullYear();
const YEARS = [CURRENT_YEAR, CURRENT_YEAR - 1, CURRENT_YEAR - 2];

async function getQuotesPage(year: number, page: number) {
  const offset = (page - 1) * PAGE_SIZE;
  const { quotes, hasMore } = await fetchQuotesPage(PAGE_SIZE, offset, year);

  const enriched = await Promise.all(
    quotes.map(async (q) => {
      const totalHT = parseFloat(q.total_net) || 0;
      const [contactResult, marginResult] = await Promise.allSettled([
        fetchContact(q.contact_id),
        totalHT > 0 ? getMaterialCostForQuote(q.id) : Promise.reject("no amount"),
      ]);
      const contact = contactResult.status === "fulfilled" ? contactResult.value : null;
      const contactName = contact ? [contact.name_1, contact.name_2].filter(Boolean).join(" ") : "";
      let netProfitRatio: number | null = null;
      if (marginResult.status === "fulfilled" && totalHT > 0) {
        netProfitRatio = calculateMargins(totalHT, marginResult.value.materialCost).netProfitRatio;
      }
      return { ...q, contact_name: contactName, totalHT, status_id: q.kb_item_status_id, netProfitRatio };
    })
  );

  return { quotes: enriched, hasMore };
}

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; page?: string }>;
}) {
  const cookieStore = await cookies();
  const session = await verifySession(cookieStore.toString());
  const sp = await searchParams;
  const year = parseInt(sp.year ?? "") || CURRENT_YEAR;
  const page = Math.max(1, parseInt(sp.page ?? "") || 1);

  let quotes: any[] = [];
  let hasMore = false;
  let error = "";
  try {
    ({ quotes, hasMore } = await getQuotesPage(year, page));
  } catch (e: any) {
    error = e.message;
  }

  const buildUrl = (y: number, p: number) => `/?year=${y}&page=${p}`;

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 px-8 py-3 flex items-center justify-between">
        <div>
          <h1 className="text-base font-semibold text-slate-900 leading-tight">Atmosphere</h1>
          <p className="text-xs text-slate-400">Dashboard Marges</p>
        </div>
        <nav className="flex items-center gap-1">
          {session?.name && (
            <>
              <span className="text-xs text-slate-400 px-2">{session.name}</span>
              <div className="w-px h-4 bg-slate-200 mx-1" />
            </>
          )}
          <a href="/analytics" className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors">
            <BarChart2 size={14} />Analyse
          </a>
          <a href="/settings" className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors">
            <Settings size={14} />Paramètres
          </a>
          <div className="w-px h-4 bg-slate-200 mx-1" />
          <a href="/api/auth/logout" title="Déconnexion" className="inline-flex items-center justify-center size-8 rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors">
            <LogOut size={15} />
          </a>
        </nav>
      </header>

      <main className="max-w-6xl mx-auto px-8 py-6">
        {error && (
          <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 text-sm">
            Erreur API Bexio : {error}
          </div>
        )}

        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-1">
            {YEARS.map((y) => (
              <Button key={y} variant={y === year ? "default" : "ghost"} size="sm" render={<Link href={buildUrl(y, 1)} />}>
                {y}
              </Button>
            ))}
          </div>
          <span className="text-xs text-slate-400">
            Page {page} · {quotes.length} offre{quotes.length !== 1 ? "s" : ""}
          </span>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
          <div className="grid grid-cols-7 gap-4 px-6 py-2.5 border-b border-slate-100 bg-slate-50 text-xs font-semibold text-slate-400 uppercase tracking-wider">
            <div>N° Offre</div>
            <div className="col-span-2">Client</div>
            <div>Date</div>
            <div className="text-right">Montant HT</div>
            <div className="text-center">Statut</div>
            <div className="text-center">Marge nette</div>
          </div>

          {quotes.length === 0 && !error && (
            <div className="px-6 py-16 text-center text-slate-400 text-sm">
              Aucune offre pour {year}
            </div>
          )}

          {quotes.map((q: any) => <QuoteRow key={q.id} quote={q} />)}
        </div>

        {(page > 1 || hasMore) && (
          <div className="flex justify-end gap-2 mt-4">
            {page > 1 && (
              <Button variant="outline" size="sm" render={<Link href={buildUrl(year, page - 1)} />}>
                ← Précédent
              </Button>
            )}
            {hasMore && (
              <Button variant="outline" size="sm" render={<Link href={buildUrl(year, page + 1)} />}>
                Suivant →
              </Button>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
