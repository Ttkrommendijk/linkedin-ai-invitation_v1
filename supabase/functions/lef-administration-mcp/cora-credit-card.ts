export type ParsedCreditCardTransaction = {
  sourceRowKey: string;
  transactionDate: string;
  description: string;
  counterpartyName: string;
  amount: number;
  currency: string;
  transactionKind: "expense" | "refund";
  cardLastFour: string | null;
  installmentNumber: number | null;
  installmentCount: number | null;
  rawData: Record<string, unknown>;
};

export type ParsedCoraCreditCardStatement = {
  issuer: "Cora";
  accountHolder: string | null;
  accountHolderTaxId: string | null;
  invoiceMonth: string | null;
  accountingPeriod: string;
  periodFrom: string;
  periodTo: string;
  closingDate: string;
  dueDate: string;
  declaredTotal: number;
  minimumPayment: number | null;
  creditLimit: number | null;
  availableLimit: number | null;
  currency: "BRL";
  cardLastFours: string[];
  transactions: ParsedCreditCardTransaction[];
  warnings: string[];
};

const MONTHS: Record<string, number> = {
  janeiro: 1,
  fevereiro: 2,
  marco: 3,
  abril: 4,
  maio: 5,
  junho: 6,
  julho: 7,
  agosto: 8,
  setembro: 9,
  outubro: 10,
  novembro: 11,
  dezembro: 12,
};

function normalized(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function brl(value: string | null) {
  if (!value) return null;
  const clean = value.replace(/R\$/gi, "").replace(/\s/g, "");
  const negative = clean.startsWith("-") || clean.endsWith("-");
  const numeric = Number(clean.replace(/^-/, "").replace(/-$/, "").replace(/\./g, "").replace(",", "."));
  return Number.isFinite(numeric) ? (negative ? -numeric : numeric) : null;
}

function isoDate(day: string, month: string, year: string) {
  const date = `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  if (Number.isNaN(Date.parse(`${date}T00:00:00Z`))) throw new Error(`invalid date in Cora PDF: ${day}/${month}/${year}`);
  return date;
}

function firstMatch(source: string, expression: RegExp) {
  return expression.exec(source)?.[1]?.trim() || null;
}

function installment(description: string) {
  const match = /(?:^|\s)(\d{1,2})\s*\/\s*(\d{1,2})(?:\s|$)/.exec(description);
  if (!match) return { installmentNumber: null, installmentCount: null };
  const current = Number(match[1]);
  const count = Number(match[2]);
  if (current < 1 || count < 1 || current > count) return { installmentNumber: null, installmentCount: null };
  return { installmentNumber: current, installmentCount: count };
}

async function sha256(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function parseCoraCreditCardText(rawText: string): Promise<ParsedCoraCreditCardStatement> {
  const text = rawText.replace(/\r/g, "").replace(/\u00a0/g, " ");
  const plain = normalized(text);
  if (!plain.includes("cora sociedade de credito direto") || !plain.includes("resumo da fatura") || !plain.includes("lancamentos")) {
    throw new Error("PDF is not a recognizable Cora credit-card statement");
  }

  const coverage = /Total de compras\s+(\d{2})\/(\d{2})\s+a\s+(\d{2})\/(\d{2})/i.exec(text)
    || /Lan[cç]amentos\s+(\d{2})\/(\d{2})\/(\d{4})\s+a\s+(\d{2})\/(\d{2})\/(\d{4})/i.exec(text);
  const datedCoverage = coverage && coverage.length === 7;
  const yearMatch = /Lan[cç]amentos\s+\d{2}\/\d{2}\/(\d{4})\s+a\s+\d{2}\/\d{2}\/(\d{4})/i.exec(text);
  const inferredYear = yearMatch?.[2] || yearMatch?.[1] || /\b(20\d{2})\b/.exec(text)?.[1];
  if (!coverage || !inferredYear) throw new Error("Cora PDF purchase coverage or year could not be determined");

  const fromDay = coverage[1];
  const fromMonth = coverage[2];
  const toDay = datedCoverage ? coverage[4] : coverage[3];
  const toMonth = datedCoverage ? coverage[5] : coverage[4];
  const fromYear = datedCoverage ? coverage[3] : inferredYear;
  const toYear = datedCoverage ? coverage[6] : inferredYear;
  const periodFrom = isoDate(fromDay, fromMonth, fromYear);
  const periodTo = isoDate(toDay, toMonth, toYear);

  const invoiceMonthName = firstMatch(text, /sua fatura de\s+([A-Za-zÀ-ÿ]+)/i);
  const invoiceMonth = invoiceMonthName ? MONTHS[normalized(invoiceMonthName)] || null : null;
  const closingMonth = invoiceMonth || Number(toMonth);
  const accountingPeriod = `${toYear}-${String(closingMonth).padStart(2, "0")}`;
  const closingDate = isoDate(toDay, toMonth, toYear);

  const due = /Vencimento:\s*(\d{1,2})\s+de\s+([A-Za-zÀ-ÿ]+)(?:\s+de\s+(\d{4}))?/i.exec(text);
  if (!due) throw new Error("Cora PDF due date could not be determined");
  const dueMonth = MONTHS[normalized(due[2])];
  if (!dueMonth) throw new Error(`unsupported Portuguese month in due date: ${due[2]}`);
  const dueDate = isoDate(due[1], String(dueMonth), due[3] || toYear);

  const declaredTotal = brl(firstMatch(text, /Total a pagar\s+R\$\s*([\d.]+,\d{2})/i));
  if (declaredTotal === null) throw new Error("Cora PDF total amount could not be determined");

  const minimumPayment = brl(firstMatch(text, /Pagamento m[ií]nimo:\s*R\$\s*([\d.]+,\d{2})/i));
  const creditLimit = brl(firstMatch(text, /Limite total:\s*R\$\s*([\d.]+,\d{2})/i));
  const availableLimit = brl(firstMatch(text, /Limite dispon[ií]vel:\s*R\$\s*([\d.]+,\d{2})/i));
  const accountHolder = firstMatch(text, /^([^\n]+)\nCNPJ\s+[\d./-]+/m);
  const accountHolderTaxId = firstMatch(text, /^CNPJ\s+([\d./-]+)/m);

  const lines = text.split("\n").map((line) => line.trim()).filter(Boolean);
  const transactions: ParsedCreditCardTransaction[] = [];
  let cardLastFour: string | null = null;
  for (let index = 0; index < lines.length; index++) {
    const card = /[•*]{4}\s*(\d{4})/.exec(lines[index]);
    if (card) cardLastFour = card[1];

    const row = /^(\d{2})\/(\d{2})\/(\d{4})\s+(.+?)\s+(-?\s*[\d.]+,\d{2}-?)$/.exec(lines[index]);
    if (!row) continue;
    const originalAmount = brl(row[5]);
    if (originalAmount === null) continue;
    const description = row[4].trim();
    const isRefund = originalAmount < 0 || /\b(estorno|reembolso|cr[eé]dito)\b/i.test(description);
    const amount = isRefund ? Math.abs(originalAmount) : -Math.abs(originalAmount);
    const details: string[] = [];
    for (let detailIndex = index + 1; detailIndex < lines.length; detailIndex++) {
      if (/^\d{2}\/\d{2}\/\d{4}\s+/.test(lines[detailIndex]) || /[•*]{4}\s*\d{4}/.test(lines[detailIndex])) break;
      if (/^(?:USD|EUR|Convers[aã]o|IOF\b)/i.test(lines[detailIndex])) details.push(lines[detailIndex]);
      else if (details.length) break;
    }
    const installments = installment(description);
    const baseKey = [isoDate(row[1], row[2], row[3]), description, amount.toFixed(2), cardLastFour || "", transactions.length].join("|");
    transactions.push({
      sourceRowKey: `cora:${await sha256(baseKey)}`,
      transactionDate: isoDate(row[1], row[2], row[3]),
      description,
      counterpartyName: description.replace(/(?:^|\s)\d{1,2}\s*\/\s*\d{1,2}(?:\s|$)/, " ").replace(/\s+/g, " ").trim(),
      amount,
      currency: "BRL",
      transactionKind: isRefund ? "refund" : "expense",
      cardLastFour,
      installmentNumber: installments.installmentNumber,
      installmentCount: installments.installmentCount,
      rawData: { displayed_amount: originalAmount, details },
    });
  }
  if (!transactions.length) throw new Error("Cora PDF contains no importable credit-card transactions");

  const warnings: string[] = [];
  const transactionTotal = Math.abs(transactions.reduce((sum, row) => sum + row.amount, 0));
  if (Math.abs(transactionTotal - declaredTotal) >= 0.01) {
    warnings.push(`Transaction total R$ ${transactionTotal.toFixed(2)} differs from invoice total R$ ${declaredTotal.toFixed(2)}.`);
  }
  if (invoiceMonth && invoiceMonth !== Number(toMonth)) {
    warnings.push("Invoice month differs from the purchase-coverage ending month.");
  }

  return {
    issuer: "Cora",
    accountHolder,
    accountHolderTaxId,
    invoiceMonth: invoiceMonthName ? normalized(invoiceMonthName) : null,
    accountingPeriod,
    periodFrom,
    periodTo,
    closingDate,
    dueDate,
    declaredTotal,
    minimumPayment,
    creditLimit,
    availableLimit,
    currency: "BRL",
    cardLastFours: [...new Set(transactions.map((row) => row.cardLastFour).filter((value): value is string => Boolean(value)))],
    transactions,
    warnings,
  };
}

export function creditCardSummary(parsed: ParsedCoraCreditCardStatement) {
  const expenses = parsed.transactions.filter((row) => row.amount < 0).reduce((sum, row) => sum + row.amount, 0);
  const refunds = parsed.transactions.filter((row) => row.amount > 0).reduce((sum, row) => sum + row.amount, 0);
  return {
    issuer: parsed.issuer,
    account_holder: parsed.accountHolder,
    account_holder_tax_id: parsed.accountHolderTaxId,
    accounting_period: parsed.accountingPeriod,
    invoice_month: parsed.invoiceMonth,
    period_from: parsed.periodFrom,
    period_to: parsed.periodTo,
    closing_date: parsed.closingDate,
    due_date: parsed.dueDate,
    declared_total: parsed.declaredTotal,
    minimum_payment: parsed.minimumPayment,
    credit_limit: parsed.creditLimit,
    available_limit: parsed.availableLimit,
    currency: parsed.currency,
    cards: parsed.cardLastFours.map((lastFour) => `••••${lastFour}`),
    transaction_count: parsed.transactions.length,
    expense_total: Number(expenses.toFixed(2)),
    refund_total: Number(refunds.toFixed(2)),
    net_total: Number((expenses + refunds).toFixed(2)),
    warnings: parsed.warnings,
  };
}
