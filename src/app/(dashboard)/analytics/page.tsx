import { fetchOrders, fetchInvoices, fetchContact, fetchArticleGroups, BexioOrder, BexioInvoice } from "@/lib/bexio";
import PaymentDonut from "@/components/charts/PaymentDonut";
import ClientGroupsBar from "@/components/charts/ClientGroupsBar";
import ComparisonBar from "@/components/charts/ComparisonBar";

const CHF = (n: number) =>
  "CHF " + Math.round(n).toLocaleString("fr-CH").replace(/\s/g, "'");

const PCT = (n: number) => (n >= 0 ? "+" : "") + (n * 100).toFixed(1) + "%";

function getInvoicePaymentStatus(inv: BexioInvoice): string {
  const remaining = parseFloat(inv.total_remaining_payments) || 0;
  const received = parseFloat(inv.total_received_payments) || 0;
  if (remaining <= 0) return "Payée";
  if (received > 0) return "Partiellement payée";
  return "En suspens";
}

function getYear(dateStr: string) {
  return dateStr ? parseInt(dateStr.substring(0, 4)) : 0;
}

function getYearMonth(dateStr: string) {
  return dateStr ? dateStr.substring(0, 7) : "";
}

function isInPeriod(dateStr: string, startMonth: string, endMonth: string) {
  const ym = getYearMonth(dateStr);
  return ym >= startMonth && ym <= endMonth;
}

function classifyClientGroup(contactName: string): string {
  const n = contactName.toLowerCase();
  if (n.includes("ad carrelage")) return "AD Carrelage SA";
  if (n.includes("sassi")) return "Carrelages Sassi SA";
  if (n.includes("etsa") || n.includes("mic marly") || n.includes("mic ") || n.includes("marly")) return "ETSA — MIC Marly";
  return "Nelson (autres clients)";
}

async function buildAnalytics(year: number) {
  const [allOrders, allInvoices, articleGroups] = await Promise.all([
    fetchOrders(),
    fetchInvoices(),
    fetchArticleGroups(),
  ]);

  const groupMap = new Map(articleGroups.map((g) => [g.id, g.name]));

  // Filter to selected year
  const orders = allOrders.filter((o) => getYear(o.is_valid_from) === year);
  const invoices = allInvoices.filter((i) => getYear(i.is_valid_from) === year);

  // Enrich orders with contact names
  const contactCache = new Map<number, string>();
  const enrichedOrders: (BexioOrder & { contact_name: string; totalHT: number })[] = [];
  for (const order of orders) {
    if (!contactCache.has(order.contact_id)) {
      try {
        const c = await fetchContact(order.contact_id);
        contactCache.set(order.contact_id, [c.name_1, c.name_2].filter(Boolean).join(" "));
      } catch {
        contactCache.set(order.contact_id, "Inconnu");
      }
    }
    enrichedOrders.push({
      ...order,
      contact_name: contactCache.get(order.contact_id) ?? "",
      totalHT: parseFloat(order.total_net) || 0,
    });
  }

  // Overview
  const totalOrdersHT = enrichedOrders.reduce((s, o) => s + o.totalHT, 0);
  const totalInvoicesHT = invoices.reduce((s, i) => s + (parseFloat(i.total_net) || 0), 0);

  // Invoice payment status based on total_remaining_payments
  const statusGroups: Record<string, { amount: number; count: number }> = {};
  for (const inv of invoices) {
    const statusLabel = getInvoicePaymentStatus(inv);
    const ht = parseFloat(inv.total_net) || 0;
    if (!statusGroups[statusLabel]) statusGroups[statusLabel] = { amount: 0, count: 0 };
    statusGroups[statusLabel].amount += ht;
    statusGroups[statusLabel].count += 1;
  }
  const paidHT = statusGroups["Payée"]?.amount ?? 0;
  const unpaidHT = totalInvoicesHT - paidHT;

  // By client group
  const clientGroups: Record<string, number> = {};
  for (const o of enrichedOrders) {
    const group = classifyClientGroup(o.contact_name);
    clientGroups[group] = (clientGroups[group] ?? 0) + o.totalHT;
  }
  const clientGroupsSorted = Object.entries(clientGroups)
    .sort((a, b) => b[1] - a[1])
    .map(([name, total]) => ({ name, total, pct: total / totalOrdersHT }));

  // Year comparison (same period Jan–Jun)
  const now = new Date();
  const compEndMonth = `${year}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const compStartPrev = `${year - 1}-01`;
  const compStartCur = `${year}-01`;

  const prevYearOrders = allOrders.filter(
    (o) => isInPeriod(o.is_valid_from, compStartPrev, `${year - 1}-${String(now.getMonth() + 1).padStart(2, "0")}`)
  );
  const curYearOrders = allOrders.filter(
    (o) => isInPeriod(o.is_valid_from, compStartCur, compEndMonth)
  );

  const prevYearInvoices = allInvoices.filter(
    (i) => isInPeriod(i.is_valid_from, compStartPrev, `${year - 1}-${String(now.getMonth() + 1).padStart(2, "0")}`)
  );
  const curYearInvoices = allInvoices.filter(
    (i) => isInPeriod(i.is_valid_from, compStartCur, compEndMonth)
  );

  const prevOrdTotal = prevYearOrders.reduce((s, o) => s + (parseFloat(o.total_net) || 0), 0);
  const curOrdTotal = curYearOrders.reduce((s, o) => s + (parseFloat(o.total_net) || 0), 0);
  const prevInvTotal = prevYearInvoices.reduce((s, i) => s + (parseFloat(i.total_net) || 0), 0);
  const curInvTotal = curYearInvoices.reduce((s, i) => s + (parseFloat(i.total_net) || 0), 0);

  const prevPaid = prevYearInvoices
    .filter((i) => getInvoicePaymentStatus(i) === "Payée")
    .reduce((s, i) => s + (parseFloat(i.total_net) || 0), 0);
  const curPaid = curYearInvoices
    .filter((i) => getInvoicePaymentStatus(i) === "Payée")
    .reduce((s, i) => s + (parseFloat(i.total_net) || 0), 0);

  const prevUnpaid = prevInvTotal - prevPaid;
  const curUnpaid = curInvTotal - curPaid;

  // Client groups year comparison
  const prevClientGroups: Record<string, number> = {};
  for (const o of prevYearOrders) {
    const cname = contactCache.get(o.contact_id) ?? "";
    const group = classifyClientGroup(cname);
    prevClientGroups[group] = (prevClientGroups[group] ?? 0) + (parseFloat(o.total_net) || 0);
  }
  const curClientGroups: Record<string, number> = {};
  for (const o of curYearOrders) {
    const cname = contactCache.get(o.contact_id) ?? "";
    const group = classifyClientGroup(cname);
    curClientGroups[group] = (curClientGroups[group] ?? 0) + (parseFloat(o.total_net) || 0);
  }

  const allGroups = Array.from(new Set([
    ...Object.keys(prevClientGroups),
    ...Object.keys(curClientGroups),
  ])).sort();

  return {
    year,
    totalOrdersHT,
    totalInvoicesHT,
    orderCount: orders.length,
    invoiceCount: invoices.length,
    paidHT,
    unpaidHT,
    statusGroups,
    clientGroupsSorted,
    ecartOrdresFactures: totalOrdersHT - totalInvoicesHT,
    comparison: {
      period: `01/01 – ${String(now.getDate()).padStart(2, "0")}/${String(now.getMonth() + 1).padStart(2, "0")}`,
      prevYear: year - 1,
      curYear: year,
      prevOrdTotal,
      curOrdTotal,
      prevInvTotal,
      curInvTotal,
      prevPaid,
      curPaid,
      prevUnpaid,
      curUnpaid,
      prevOrdCount: prevYearOrders.length,
      curOrdCount: curYearOrders.length,
      allGroups,
      prevClientGroups,
      curClientGroups,
    },
  };
}

function DeltaBadge({ prev, cur }: { prev: number; cur: number }) {
  const delta = prev > 0 ? (cur - prev) / prev : 0;
  const pct = (delta * 100).toFixed(1);
  const positive = delta >= 0;
  return (
    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${positive ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>
      {positive ? "+" : ""}{pct}%
    </span>
  );
}

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string }>;
}) {
  const sp = await searchParams;
  const year = parseInt(sp.year ?? "") || new Date().getFullYear() - 1;

  let data: Awaited<ReturnType<typeof buildAnalytics>> | null = null;
  let error = "";
  try {
    data = await buildAnalytics(year);
  } catch (e: any) {
    error = e.message;
  }

  const availableYears = [2024, 2025, 2026];

  return (
    <div className="flex flex-col h-full">
      {/* Page header */}
      <div className="bg-white border-b border-slate-200 px-8 py-5 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-slate-900">Analyse</h1>
          <p className="text-sm text-slate-400 mt-0.5">Vue d'ensemble des ventes et paiements</p>
        </div>
        <div className="flex items-center gap-1">
          {availableYears.map((y) => (
            <a key={y} href={`/analytics?year=${y}`}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                y === year ? "bg-slate-900 text-white" : "text-slate-500 hover:bg-slate-100 hover:text-slate-900"
              }`}>
              {y}
            </a>
          ))}
        </div>
      </div>

      <main className="flex-1 px-8 py-6 space-y-6">

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 text-sm">
            Erreur API Bexio : {error}
          </div>
        )}

        {data && (
          <>
            {/* 1. Vue d'ensemble */}
            <section>
              <SectionTitle num="1" title={`Vue d'ensemble — ${data.year}`} />
              <div className="grid grid-cols-4 gap-3 mb-3">
                <StatCard label="Total ordres" value={CHF(data.totalOrdersHT)} sub={`${data.orderCount} documents`} />
                <StatCard label="Total factures" value={CHF(data.totalInvoicesHT)} sub={`${data.invoiceCount} documents`} />
                <StatCard label="Montant encaissé" value={CHF(data.paidHT)} sub={`${((data.paidHT / data.totalInvoicesHT) * 100).toFixed(1)}% du facturé`} accent="emerald" />
                <StatCard label="Solde non encaissé" value={CHF(data.unpaidHT)} sub="En suspens + partiel" accent={data.unpaidHT > 50000 ? "red" : "slate"} />
              </div>
              <div className="grid grid-cols-5 gap-4">
                <div className="col-span-3 bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                  <table className="w-full text-sm">
                    <thead className="border-b border-slate-100 text-xs text-slate-400 uppercase tracking-wide">
                      <tr>
                        <th className="text-left px-5 py-3 font-semibold">Statut des factures</th>
                        <th className="text-right px-5 py-3 font-semibold">Montant HT</th>
                        <th className="text-right px-5 py-3 font-semibold">Documents</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(data.statusGroups).map(([label, { amount, count }]) => (
                        <tr key={label} className="border-b border-slate-50 last:border-0">
                          <td className="px-5 py-3 text-slate-700">{label}</td>
                          <td className="px-5 py-3 text-right font-bold text-slate-900 tabular-nums">{CHF(amount)}</td>
                          <td className="px-5 py-3 text-right text-slate-500">{count}</td>
                        </tr>
                      ))}
                      <tr className="bg-slate-50 border-t border-slate-200">
                        <td className="px-5 py-3 text-slate-500 text-xs">Écart ordres › factures (non encore facturé)</td>
                        <td className="px-5 py-3 text-right font-bold text-slate-700 tabular-nums">{CHF(data.ecartOrdresFactures)}</td>
                        <td />
                      </tr>
                    </tbody>
                  </table>
                </div>
                <div className="col-span-2 bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col">
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide px-5 pt-4 pb-1">Répartition des paiements</p>
                  <div className="flex-1 px-2 pb-3">
                    <PaymentDonut data={Object.entries(data.statusGroups).map(([label, { amount }]) => ({ label, amount }))} />
                  </div>
                </div>
              </div>
            </section>

            {/* 2. Groupes clients */}
            <section>
              <SectionTitle num="2" title={`Répartition par groupe client — ${data.year}`} />
              <div className="grid grid-cols-5 gap-4">
                <div className="col-span-3 bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                  <table className="w-full text-sm">
                    <thead className="border-b border-slate-100 text-xs text-slate-400 uppercase tracking-wide">
                      <tr>
                        <th className="text-left px-5 py-3 font-semibold w-8">#</th>
                        <th className="text-left px-5 py-3 font-semibold">Groupe</th>
                        <th className="text-right px-5 py-3 font-semibold">CA HT</th>
                        <th className="text-right px-5 py-3 font-semibold w-48">Part</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.clientGroupsSorted.map((g, i) => (
                        <tr key={g.name} className="border-b border-slate-50 last:border-0">
                          <td className="px-5 py-3 text-slate-300 text-xs font-mono">{i + 1}</td>
                          <td className="px-5 py-3 font-medium text-slate-900">{g.name}</td>
                          <td className="px-5 py-3 text-right font-bold text-slate-900 tabular-nums">{CHF(g.total)}</td>
                          <td className="px-5 py-3">
                            <div className="flex items-center justify-end gap-2">
                              <div className="w-24 bg-slate-100 rounded-full h-1.5 overflow-hidden">
                                <div className="bg-slate-700 h-1.5 rounded-full" style={{ width: `${g.pct * 100}%` }} />
                              </div>
                              <span className="text-slate-600 font-semibold tabular-nums w-10 text-right text-xs">{(g.pct * 100).toFixed(1)}%</span>
                            </div>
                          </td>
                        </tr>
                      ))}
                      <tr className="bg-slate-50 border-t border-slate-200">
                        <td className="px-5 py-3" />
                        <td className="px-5 py-3 text-slate-500 font-semibold text-xs uppercase tracking-wide">Total</td>
                        <td className="px-5 py-3 text-right font-bold text-slate-900 tabular-nums">{CHF(data.totalOrdersHT)}</td>
                        <td className="px-5 py-3 text-right text-slate-500 font-semibold text-xs">100%</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <div className="col-span-2 bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col">
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide px-5 pt-4 pb-1">CA par groupe (CHF HT)</p>
                  <div className="flex-1 px-2 pb-3">
                    <ClientGroupsBar data={data.clientGroupsSorted} />
                  </div>
                </div>
              </div>
            </section>

            {/* 3. Comparaison */}
            <section>
              <SectionTitle
                num="3"
                title={`Comparaison ${data.comparison.period} : ${data.comparison.prevYear} vs ${data.comparison.curYear}`}
                sub="Même période calendaire, toutes offres incluses"
              />
              <div className="grid grid-cols-5 gap-4 mb-4">
                <div className="col-span-3 bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                  <table className="w-full text-sm">
                    <thead className="border-b border-slate-100 text-xs text-slate-400 uppercase tracking-wide">
                      <tr>
                        <th className="text-left px-5 py-3 font-semibold">Indicateur</th>
                        <th className="text-right px-5 py-3 font-semibold">{data.comparison.prevYear}</th>
                        <th className="text-right px-5 py-3 font-semibold">{data.comparison.curYear}</th>
                        <th className="text-right px-5 py-3 font-semibold">Évolution</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        { label: "Total ordres (HT)", prev: data.comparison.prevOrdTotal, cur: data.comparison.curOrdTotal },
                        { label: "Total factures (HT)", prev: data.comparison.prevInvTotal, cur: data.comparison.curInvTotal },
                        { label: "Montant encaissé (HT)", prev: data.comparison.prevPaid, cur: data.comparison.curPaid },
                        { label: "Solde non encaissé", prev: data.comparison.prevUnpaid, cur: data.comparison.curUnpaid },
                      ].map(({ label, prev, cur }) => (
                        <tr key={label} className="border-b border-slate-50 last:border-0">
                          <td className="px-5 py-3 text-slate-700">{label}</td>
                          <td className="px-5 py-3 text-right text-slate-500 tabular-nums">{CHF(prev)}</td>
                          <td className="px-5 py-3 text-right font-bold text-slate-900 tabular-nums">{CHF(cur)}</td>
                          <td className="px-5 py-3 text-right">
                            {prev > 0 ? <DeltaBadge prev={prev} cur={cur} /> : <span className="text-xs text-slate-300">-</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="col-span-2 bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col">
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide px-5 pt-4 pb-1">
                    {data.comparison.prevYear} vs {data.comparison.curYear}
                  </p>
                  <div className="flex-1 px-2 pb-3">
                    <ComparisonBar
                      prevYear={data.comparison.prevYear}
                      curYear={data.comparison.curYear}
                      data={[
                        { label: "Total ordres (HT)", prev: data.comparison.prevOrdTotal, cur: data.comparison.curOrdTotal },
                        { label: "Total factures (HT)", prev: data.comparison.prevInvTotal, cur: data.comparison.curInvTotal },
                        { label: "Montant encaissé (HT)", prev: data.comparison.prevPaid, cur: data.comparison.curPaid },
                        { label: "Solde non encaissé", prev: data.comparison.prevUnpaid, cur: data.comparison.curUnpaid },
                      ]}
                    />
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                <div className="px-5 py-3 border-b border-slate-100">
                  <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Groupes clients — même période</h3>
                </div>
                <table className="w-full text-sm">
                  <thead className="border-b border-slate-100 text-xs text-slate-400 uppercase tracking-wide">
                    <tr>
                      <th className="text-left px-5 py-3 font-semibold">Groupe</th>
                      <th className="text-right px-5 py-3 font-semibold">{data.comparison.prevYear}</th>
                      <th className="text-right px-5 py-3 font-semibold">{data.comparison.curYear}</th>
                      <th className="text-right px-5 py-3 font-semibold">Évolution</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.comparison.allGroups.map((group) => {
                      const prev = data!.comparison.prevClientGroups[group] ?? 0;
                      const cur = data!.comparison.curClientGroups[group] ?? 0;
                      return (
                        <tr key={group} className="border-b border-slate-50 last:border-0">
                          <td className="px-5 py-3 font-medium text-slate-900">{group}</td>
                          <td className="px-5 py-3 text-right text-slate-500 tabular-nums">{CHF(prev)}</td>
                          <td className="px-5 py-3 text-right font-bold text-slate-900 tabular-nums">{CHF(cur)}</td>
                          <td className="px-5 py-3 text-right">
                            {prev > 0 ? <DeltaBadge prev={prev} cur={cur} /> : <span className="text-xs text-slate-300">nouveau</span>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
}

function SectionTitle({ num, title, sub }: { num: string; title: string; sub?: string }) {
  return (
    <div className="mb-3">
      <h2 className="text-base font-bold text-slate-900">
        <span className="text-slate-300 font-mono text-sm mr-2">{num}.</span>{title}
      </h2>
      {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
    </div>
  );
}

function StatCard({ label, value, sub, accent = "slate" }: {
  label: string; value: string; sub: string; accent?: "slate" | "emerald" | "red";
}) {
  const styles = {
    slate:   "bg-white border-slate-200 text-slate-900",
    emerald: "bg-emerald-50 border-emerald-200 text-emerald-800",
    red:     "bg-red-50 border-red-200 text-red-800",
  };
  return (
    <div className={`rounded-xl border p-5 shadow-sm ${styles[accent]}`}>
      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">{label}</p>
      <p className="text-xl font-bold tabular-nums">{value}</p>
      <p className="text-xs text-slate-400 mt-1">{sub}</p>
    </div>
  );
}
