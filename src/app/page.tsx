import { fetchQuotes, fetchContact } from "@/lib/bexio";
import QuoteList from "@/components/QuoteList";

async function getQuotes() {
  const quotes = await fetchQuotes();
  return Promise.all(
    quotes.map(async (q) => {
      let contactName = "";
      try {
        const c = await fetchContact(q.contact_id);
        contactName = [c.name_1, c.name_2].filter(Boolean).join(" ");
      } catch {}
      const totalHT = parseFloat(q.total_net) || 0;
      const totalTTC = parseFloat(q.total) || 0;
      return { ...q, contact_name: contactName, totalHT, totalTTC, date: q.is_valid_from, status_id: q.kb_item_status_id };
    })
  );
}

export default async function HomePage() {
  let quotes: any[] = [];
  let error = "";
  try {
    quotes = await getQuotes();
  } catch (e: any) {
    error = e.message;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-8 py-5 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Atmosphere — Dashboard Marges</h1>
          <p className="text-sm text-gray-500 mt-1">Analyse des offres Bexio</p>
        </div>
        <a href="/settings" className="text-sm font-medium text-gray-600 hover:text-gray-900 border border-gray-200 rounded-lg px-4 py-2 hover:bg-gray-50 transition">
          ⚙ Paramètres
        </a>
      </header>

      <main className="max-w-6xl mx-auto px-8 py-8">
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 text-sm">
            Erreur API Bexio : {error}
            <br />
            <span className="opacity-70">Vérifiez votre token dans <code>.env.local</code></span>
          </div>
        )}

        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6 text-sm text-blue-800">
          <span className="font-semibold">Cibles marges (Excel Atmosphere) : </span>
          Matériel max <strong>60%</strong> du HT · Bénéfice brut exploitation <strong>23%</strong> · Charges fixes <strong>15%</strong> · Bénéfice net <strong>8%</strong>
          <span className="opacity-70 ml-2 text-xs">— Marge détaillée par offre (cliquer sur une ligne)</span>
        </div>

        <QuoteList quotes={quotes} />
      </main>
    </div>
  );
}
