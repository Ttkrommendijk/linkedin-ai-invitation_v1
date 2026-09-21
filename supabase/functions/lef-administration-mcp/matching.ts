type MatchTransaction = {
  transaction_date: string;
  description: string;
  counterparty_name?: string | null;
  amount: number | string;
  currency: string;
  raw_data?: Record<string, unknown> | null;
};

type MatchDocument = {
  issue_date?: string | null;
  due_date?: string | null;
  counterparty_name?: string | null;
  total_amount?: number | string | null;
  currency: string;
  extracted_data?: Record<string, unknown> | null;
};

export type MatchScore = {
  confidence: number;
  reasons: Array<{ factor: string; score: number; detail: string }>;
};

function plain(value: unknown) {
  return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function tokens(value: unknown) {
  return new Set(plain(value).split(/\s+/).filter((token) => token.length > 1 && !["inc", "ltda", "sa", "the", "com", "br"].includes(token)));
}

function nameSimilarity(left: unknown, right: unknown) {
  const a = plain(left);
  const b = plain(right);
  if (!a || !b) return 0;
  if (a === b) return 1;
  if (a.includes(b) || b.includes(a)) return 0.9;
  const at = tokens(a);
  const bt = tokens(b);
  const intersection = [...at].filter((token) => bt.has(token)).length;
  const union = new Set([...at, ...bt]).size;
  return union ? intersection / union : 0;
}

function dateDistance(left?: string | null, right?: string | null) {
  if (!left || !right) return null;
  const a = Date.parse(`${left}T00:00:00Z`);
  const b = Date.parse(`${right}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.round(Math.abs(a - b) / 86_400_000);
}

function numberValue(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function originalCurrencyAmounts(transaction: MatchTransaction) {
  const results: Array<{ currency: string; amount: number }> = [];
  const raw = transaction.raw_data || {};
  const details = Array.isArray(raw.details) ? raw.details : [];
  for (const detail of details) {
    const match = /\b([A-Z]{3})\s+([\d.]+,\d{2})\b/.exec(String(detail));
    if (!match) continue;
    const amount = Number(match[2].replace(/\./g, "").replace(",", "."));
    if (Number.isFinite(amount)) results.push({ currency: match[1], amount });
  }
  for (const [key, value] of Object.entries(raw)) {
    const match = /^amount_([a-z]{3})$/i.exec(key);
    const amount = numberValue(value);
    if (match && amount !== null) results.push({ currency: match[1].toUpperCase(), amount: Math.abs(amount) });
  }
  return results;
}

function cardLastFour(source: Record<string, unknown> | null | undefined) {
  const value = source?.card_last_four;
  return typeof value === "string" && /^\d{4}$/.test(value) ? value : null;
}

export function scoreDocumentMatch(transaction: MatchTransaction, document: MatchDocument): MatchScore {
  const reasons: MatchScore["reasons"] = [];
  let score = 0;

  const supplierSimilarity = Math.max(
    nameSimilarity(transaction.counterparty_name, document.counterparty_name),
    nameSimilarity(transaction.description, document.counterparty_name),
  );
  if (supplierSimilarity >= 0.25) {
    const points = supplierSimilarity >= 0.9 ? 0.35 : supplierSimilarity >= 0.6 ? 0.25 : 0.12;
    score += points;
    reasons.push({ factor: "supplier", score: points, detail: `${Math.round(supplierSimilarity * 100)}% name similarity` });
  }

  const days = Math.min(
    ...[document.issue_date, document.due_date]
      .map((date) => dateDistance(transaction.transaction_date, date))
      .filter((value): value is number => value !== null),
  );
  if (Number.isFinite(days)) {
    const points = days === 0 ? 0.25 : days <= 3 ? 0.22 : days <= 7 ? 0.18 : days <= 31 ? 0.08 : 0;
    if (points) {
      score += points;
      reasons.push({ factor: "date", score: points, detail: `${days} day difference` });
    }
  }

  const documentAmount = numberValue(document.total_amount);
  const transactionAmount = Math.abs(numberValue(transaction.amount) || 0);
  if (documentAmount !== null && documentAmount > 0) {
    let comparableAmount: number | null = null;
    let comparisonCurrency = transaction.currency;
    if (document.currency === transaction.currency) comparableAmount = transactionAmount;
    else {
      const original = originalCurrencyAmounts(transaction).find((item) => item.currency === document.currency);
      if (original) {
        comparableAmount = original.amount;
        comparisonCurrency = original.currency;
      }
    }
    if (comparableAmount !== null) {
      const differenceRatio = Math.abs(comparableAmount - Math.abs(documentAmount)) / Math.abs(documentAmount);
      const points = differenceRatio < 0.0001 ? 0.30 : differenceRatio <= 0.01 ? 0.26 : differenceRatio <= 0.05 ? 0.16 : 0;
      if (points) {
        score += points;
        reasons.push({ factor: "amount", score: points, detail: `${comparisonCurrency} amounts differ by ${(differenceRatio * 100).toFixed(2)}%` });
      }
    }
  }

  const transactionCard = cardLastFour(transaction.raw_data);
  const documentCard = cardLastFour(document.extracted_data);
  if (transactionCard && documentCard && transactionCard === documentCard) {
    score += 0.10;
    reasons.push({ factor: "card", score: 0.10, detail: `card ending ${transactionCard}` });
  }

  return { confidence: Number(Math.min(score, 1).toFixed(2)), reasons };
}
