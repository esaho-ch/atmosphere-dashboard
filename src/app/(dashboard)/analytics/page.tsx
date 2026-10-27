import { fetchOrders, fetchInvoices, fetchContact, BexioOrder, BexioInvoice } from "@/lib/bexio";
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

function shiftYear(ym: string, delta: number) {
  return `${parseInt(ym.substring(0, 4)) + delta}${ym.substring(4)}`;
}

function formatMonth(ym: string) {
  const [y, m] = ym.split("-");
  return `${m}.${y}`;
}

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

async function buildAnalytics(from: string, to: string) {
  const [allOrders, allInvoices] = await Promise.all([fetchOrders(), fetchInvoices()]);

  const prevFrom = shiftYear(from, -1);
  const prevTo = shiftYear(to, -1);

  const orders = allOrders.filter((o) => isInPeriod(o.is_valid_from, from, to));
  const invoices = allInvoices.filter((i) => isInPeriod(i.is_valid_from, from, to));
  const prevYearOrders = allOrders.filter((o) => isInPeriod(o.is_valid_from, prevFrom, prevTo));
  const prevYearInvoices = allInvoices.filter((i) => isInPeriod(i.is_valid_from, prevFrom, prevTo));

  // Resolve contact names (unique ids, in parallel)
  const contactIds = Array.from(new Set([...orders, ...prevYearOrders].map((o) => o.contact_id)));
  const contactCache = new Map<number, string>();
  await Promise.all(
    contactIds.map(async (id) => {
      try {
        const c = await fetchContact(id);
        contactCache.set(id, [c.name_1, c.name_2].filter(Boolean).join(" "));
      } catch {
        contactCache.set(id, "Inconnu");
      }
    })
  );

  const enrichedOrders = orders.map((order) => ({
    ...order,
    contact_name: contactCache.get(order.contact_id) ?? "",
    totalHT: parseFloat(order.total_net) || 0,
  }));

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
    .map(([name, total]) => ({ name, total, pct: totalOrdersHT > 0 ? total / totalOrdersHT : 0 }));

  // Best customers (individual contacts)
  const byContact = new Map<number, { name: string; total: number; count: number }>();
  for (const o of enrichedOrders) {
    const entry = byContact.get(o.contact_id) ?? { name: o.contact_name, total: 0, count: 0 };
    entry.total += o.totalHT;
    entry.count += 1;
    byContact.set(o.contact_id, entry);
  }
  const topClients = Array.from(byContact.values())
    .sort((a, b) => b.total - a.total)
    .slice(0, 15)
    .map((c) => ({ ...c, pct: totalOrdersHT > 0 ? c.total / totalOrdersHT : 0 }));

  // Comparison with the same months one year earlier
  const sumNet = (xs: { total_net: string }[]) => xs.reduce((s, x) => s + (parseFloat(x.total_net) || 0), 0);
  const paidNet = (xs: BexioInvoice[]) => sumNet(xs.filter((i) => getInvoicePaymentStatus(i) === "Payée"));

  const prevOrdTotal = sumNet(prevYearOrders);
  const curOrdTotal = totalOrdersHT;
  const prevInvTotal = sumNet(prevYearInvoices);
  const curInvTotal = totalInvoicesHT;
  const prevPaid = paidNet(prevYearInvoices);
  const curPaid = paidHT;

  const groupTotals = (xs: BexioOrder[]) => {
    const out: Record<string, number> = {};
    for (const o of xs) {
      const group = classifyClientGroup(contactCache.get(o.contact_id) ?? "");
      out[group] = (out[group] ?? 0) + (parseFloat(o.total_net) || 0);
    }
    return out;
  };
  const prevClientGroups = groupTotals(prevYearOrders);
  const curClientGroups = groupTotals(orders);

  const allGroups = Array.from(new Set([
    ...Object.keys(prevClientGroups),
    ...Object.keys(curClientGroups),
  ])).sort();

  return {
    from,
    to,
    totalOrdersHT,
    totalInvoicesHT,
    orderCount: orders.length,
    invoiceCount: invoices.length,
    paidHT,
    unpaidHT,
    statusGroups,
    clientGroupsSorted,
    topClients,
    ecartOrdresFactures: totalOrdersHT - totalInvoicesHT,
    comparison: {
      prevLabel: `${formatMonth(prevFrom)} – ${formatMonth(prevTo)}`,
      curLabel: `${formatMonth(from)} – ${formatMonth(to)}`,
      prevOrdTotal,
      curOrdTotal,
      prevInvTotal,
      curInvTotal,
      prevPaid,
      curPaid,
      prevUnpaid: prevInvTotal - prevPaid,
      curUnpaid: curInvTotal - curPaid,
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
  searchParams: Promise<{ from?: string; to?: string; year?: string }>;
}) {
  const sp = await searchParams;
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const yearParam = parseInt(sp.year ?? "");
  const defaultYear = yearParam || now.getFullYear() - 1;

  let from = sp.from && MONTH_RE.test(sp.from) ? sp.from : `${defaultYear}-01`;
  let to = sp.to && MONTH_RE.test(sp.to) ? sp.to : `${defaultYear}-12`;
  if (from > to) [from, to] = [to, from];

  let data: Awaited<ReturnType<typeof buildAnalytics>> | null = null;
  let error = "";
  try {
    data = await buildAnalytics(from, to);
  } catch (e: any) {
    error = e.message;
  }

  const availableYears = [2024, 2025, 2026];
  const periodLabel = `${formatMonth(from)} – ${formatMonth(to)}`;

  return (
    <div className="flex flex-col h-full">
      {/* Page header */}
      <div className="bg-white border-b border-slate-200 px-8 py-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-lg font-bold text-slate-900">Analyse</h1>
          <p className="text-sm text-slate-400 mt-0.5">Vue d'ensemble des ventes et paiements</p>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <form action="/analytics" method="get" className="flex items-end gap-2">
            <label className="text-xs text-slate-400 flex flex-col gap-1">
              Du
              <input type="month" name="from" defaultValue={from} max={currentMonth}
                className="border border-slate-200 rounded-lg px-2 py-1.5 text-sm text-slate-900" />
            </label>
            <label className="text-xs text-slate-400 flex flex-col gap-1">
              Au
              <input type="month" name="to" defaultValue={to} max={currentMonth}
                className="border border-slate-200 rounded-lg px-2 py-1.5 text-sm text-slate-900" />
            </label>
            <button type="submit"
              className="px-3 py-1.5 rounded-lg text-sm font-medium bg-slate-900 text-white hover:bg-slate-700 transition-colors">
              Appliquer
            </button>
          </form>
          <div className="flex items-center gap-1">
            {availableYears.map((y) => {
              const active = from === `${y}-01` && to === `${y}-12`;
              return (
                <a key={y} href={`/analytics?from=${y}-01&to=${y}-12`}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    active ? "bg-slate-900 text-white" : "text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                  }`}>
                  {y}
                </a>
              );
            })}
            <a href={`/analytics?from=2024-05&to=${currentMonth}`}
              className="px-3 py-1.5 rounded-lg text-sm font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition-colors">
              Tout
            </a>
          </div>
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
              <SectionTitle num="1" title={`Vue d'ensemble — ${periodLabel}`} />
              <div className="grid grid-cols-4 gap-3 mb-3">
                <StatCard label="Total ordres" value={CHF(data.totalOrdersHT)} sub={`${data.orderCount} documents`} />
                <StatCard label="Total factures" value={CHF(data.totalInvoicesHT)} sub={`${data.invoiceCount} documents`} />
                <StatCard label="Montant encaissé" value={CHF(data.paidHT)} sub={`${((data.totalInvoicesHT > 0 ? (data.paidHT / data.totalInvoicesHT) * 100 : 0)).toFixed(1)}% du facturé`} accent="emerald" />
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
              <SectionTitle num="2" title={`Répartition par groupe client — ${periodLabel}`} />
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

            {/* Meilleurs clients */}
            <section>
              <SectionTitle num="3" title={`Meilleurs clients — ${periodLabel}`} sub="Classés par chiffre d'affaires (ordres HT)" />
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                <table className="w-full text-sm">
                  <thead className="border-b border-slate-100 text-xs text-slate-400 uppercase tracking-wide">
                    <tr>
                      <th className="text-left px-5 py-3 font-semibold w-8">#</th>
                      <th className="text-left px-5 py-3 font-semibold">Client</th>
                      <th className="text-right px-5 py-3 font-semibold">Ordres</th>
                      <th className="text-right px-5 py-3 font-semibold">CA HT</th>
                      <th className="text-right px-5 py-3 font-semibold w-48">Part</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.topClients.length === 0 && (
                      <tr><td colSpan={5} className="px-5 py-6 text-center text-slate-400">Aucun ordre sur cette période</td></tr>
                    )}
                    {data.topClients.map((c, i) => (
                      <tr key={c.name + i} className="border-b border-slate-50 last:border-0">
                        <td className="px-5 py-3 text-slate-300 text-xs font-mono">{i + 1}</td>
                        <td className="px-5 py-3 font-medium text-slate-900">{c.name || "Inconnu"}</td>
                        <td className="px-5 py-3 text-right text-slate-500">{c.count}</td>
                        <td className="px-5 py-3 text-right font-bold text-slate-900 tabular-nums">{CHF(c.total)}</td>
                        <td className="px-5 py-3 text-right text-slate-600 font-semibold tabular-nums text-xs">{(c.pct * 100).toFixed(1)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            {/* 4. Comparaison */}
            <section>
              <SectionTitle
                num="4"
                title={`Comparaison : ${data.comparison.prevLabel} vs ${data.comparison.curLabel}`}
                sub="Même période, un an plus tôt"
              />
              <div className="grid grid-cols-5 gap-4 mb-4">
                <div className="col-span-3 bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                  <table className="w-full text-sm">
                    <thead className="border-b border-slate-100 text-xs text-slate-400 uppercase tracking-wide">
                      <tr>
                        <th className="text-left px-5 py-3 font-semibold">Indicateur</th>
                        <th className="text-right px-5 py-3 font-semibold">{data.comparison.prevLabel}</th>
                        <th className="text-right px-5 py-3 font-semibold">{data.comparison.curLabel}</th>
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
                    {data.comparison.prevLabel} vs {data.comparison.curLabel}
                  </p>
                  <div className="flex-1 px-2 pb-3">
                    <ComparisonBar
                      prevYear={data.comparison.prevLabel}
                      curYear={data.comparison.curLabel}
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
                      <th className="text-right px-5 py-3 font-semibold">{data.comparison.prevLabel}</th>
                      <th className="text-right px-5 py-3 font-semibold">{data.comparison.curLabel}</th>
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
