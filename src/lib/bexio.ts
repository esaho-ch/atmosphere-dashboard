const BEXIO_BASE_URL = "https://api.bexio.com/2.0";

function bexioHeaders() {
  return {
    Accept: "application/json",
    Authorization: `Bearer ${process.env.BEXIO_API_TOKEN}`,
  };
}

export interface BexioQuote {
  id: number;
  document_nr: string;
  title: string | null;
  contact_id: number;
  contact_name?: string;
  total_net: string;   // HT (mwst_is_net: true)
  total: string;       // TTC
  total_taxes: string;
  is_valid_from: string;
  kb_item_status_id: number;
}

export interface BexioPositionArticle {
  id: number;
  article_id: number;
  text: string;
  amount: string;
  unit_price: string;
  unit_name: string;
  discount_in_percent: string | null;
  position_total: string;
}

export interface BexioArticle {
  id: number;
  intern_name: string;
  intern_code: string;
  purchase_price: string;
  sale_price: string;
}

export interface BexioContact {
  id: number;
  name_1: string;
  name_2: string | null;
}

import { loadSettings, computeMarginTargets } from "./settings";

export function getMarginTargets() {
  return computeMarginTargets(loadSettings());
}

export function calculateMargins(totalHT: number, materialCost: number) {
  const targets = getMarginTargets();
  const tvaRate = 0.081;
  const totalTTC = totalHT * (1 + tvaRate);
  const tvaAmount = totalTTC - totalHT;
  const materialRatio = totalHT > 0 ? materialCost / totalHT : 0;
  const grossProfit = totalHT - materialCost;
  const grossProfitRatio = totalHT > 0 ? grossProfit / totalHT : 0;
  const salaryAllocation = totalHT * targets.salary_ratio;
  const grossExploitationProfit = grossProfit - salaryAllocation;
  const grossExploitationRatio = totalHT > 0 ? grossExploitationProfit / totalHT : 0;
  const fixedCostsAllocation = totalHT * targets.fixed_costs_ratio;
  const netProfit = grossExploitationProfit - fixedCostsAllocation;
  const netProfitRatio = totalHT > 0 ? netProfit / totalHT : 0;

  return {
    totalTTC,
    tvaAmount,
    totalHT,
    materialCost,
    materialRatio,
    grossProfit,
    grossProfitRatio,
    salaryAllocation,
    grossExploitationProfit,
    grossExploitationRatio,
    fixedCostsAllocation,
    netProfit,
    netProfitRatio,
  };
}

export async function fetchQuotes(): Promise<BexioQuote[]> {
  const PAGE_SIZE = 500;
  const all: BexioQuote[] = [];
  let offset = 0;

  while (true) {
    const res = await fetch(
      `${BEXIO_BASE_URL}/kb_offer?limit=${PAGE_SIZE}&offset=${offset}&order_by=id_desc`,
      { headers: bexioHeaders(), next: { revalidate: 300 } }
    );
    if (!res.ok) throw new Error(`Bexio API error: ${res.status}`);
    const page: BexioQuote[] = await res.json();
    all.push(...page);
    if (page.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }

  return all;
}

export async function fetchQuotePositions(quoteId: number): Promise<BexioPositionArticle[]> {
  const res = await fetch(
    `${BEXIO_BASE_URL}/kb_offer/${quoteId}/kb_position_article`,
    { headers: bexioHeaders(), next: { revalidate: 300 } }
  );
  if (!res.ok) throw new Error(`Bexio API error: ${res.status}`);
  return res.json();
}

export async function fetchArticle(articleId: number): Promise<BexioArticle> {
  const res = await fetch(
    `${BEXIO_BASE_URL}/article/${articleId}`,
    { headers: bexioHeaders(), next: { revalidate: 3600 } }
  );
  if (!res.ok) throw new Error(`Bexio API error: ${res.status}`);
  return res.json();
}

export async function fetchContact(contactId: number): Promise<BexioContact> {
  const res = await fetch(
    `${BEXIO_BASE_URL}/contact/${contactId}`,
    { headers: bexioHeaders(), next: { revalidate: 3600 } }
  );
  if (!res.ok) throw new Error(`Bexio API error: ${res.status}`);
  return res.json();
}

export async function getMaterialCostForQuote(quoteId: number): Promise<{
  positions: (BexioPositionArticle & { purchase_price: number; purchase_total: number })[];
  materialCost: number;
}> {
  const positions = await fetchQuotePositions(quoteId);

  const enriched = await Promise.all(
    positions.map(async (pos) => {
      let purchase_price = 0;
      try {
        const article = await fetchArticle(pos.article_id);
        purchase_price = parseFloat(article.purchase_price) || 0;
      } catch {}
      const qty = parseFloat(pos.amount) || 0;
      return { ...pos, purchase_price, purchase_total: purchase_price * qty };
    })
  );

  const materialCost = enriched.reduce((s, p) => s + p.purchase_total, 0);
  return { positions: enriched, materialCost };
}
