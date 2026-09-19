import { extractLinks, identifyProvider } from "./providers.mjs";

export const categories = [
  "כל הקטגוריות",
  "אופנה",
  "אוכל וקפה",
  "בית ולייף סטייל",
  "בריאות וספורט",
  "בילוי ופנאי",
  "כללי",
];
export const money = (value) =>
  value === null
    ? "יתרה לא ידועה"
    : new Intl.NumberFormat("he-IL", {
        style: "currency",
        currency: "ILS",
        minimumFractionDigits: Number.isInteger(value) ? 0 : 2,
        maximumFractionDigits: 2,
      }).format(value);
export function daysLeft(expiry, now = new Date()) {
  if (!expiry) return null;
  const [y, m, d] = expiry.split("-").map(Number);
  return Math.round(
    (Date.UTC(y, m - 1, d) -
      Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())) /
      86400000,
  );
}
export function statusOf(v, now) {
  if (v.balance !== null && v.balance <= 0) return "used";
  if (v.expiry && daysLeft(v.expiry, now) < 0) return "expired";
  return "active";
}
export const safeUrl = (value) => {
  try {
    const url = new URL(value);
    return ["https:", "http:"].includes(url.protocol) ? url.href : "";
  } catch {
    return "";
  }
};
export function extractVoucher(raw) {
  const text = String(raw || "").normalize("NFKC");
  const balance = text.match(
    /(?:יתרה(?:\s+(?:בכרטיס|נוכחית|למימוש))?|balance)\s*[:=]?\s*₪?\s*([\d,]+(?:\.\d{1,2})?)/i,
  );
  const amount =
    text.match(
      /(?:סכום(?:\s+מקורי)?|שווי|amount|value)\s*[:=]?\s*₪?\s*([\d,]+(?:\.\d{1,2})?)/i,
    ) ||
    (!balance &&
      (text.match(/₪\s*([\d,]+(?:\.\d{1,2})?)/) ||
        text.match(/([\d,]+(?:\.\d{1,2})?)\s*(?:₪|ש[״"']?ח)/)));
  const code = text.match(
    /(?:קוד(?:\s+(?:שובר|מימוש|מולטי\s?פאס))?|מספר\s+שובר|voucher|code)\s*[:=#־–—-]?\s*([A-Z0-9][A-Z0-9-]{3,})/i,
  );
  const date = text.match(
    /(?:תוקף|בתוקף|תאריך תפוגה|expiry|expires)\s*(?:עד\s*)?[:=]?\s*(\d{1,2})[./-](\d{1,2})[./-](\d{4})/i,
  );
  let expiry = "";
  if (date) {
    const candidate = `${date[3]}-${date[2].padStart(2, "0")}-${date[1].padStart(2, "0")}`;
    const parsed = new Date(`${candidate}T12:00:00Z`);
    if (!isNaN(parsed) && parsed.toISOString().slice(0, 10) === candidate)
      expiry = candidate;
  }
  const known = [
    ["BUYME", /buyme|ביי\s?מי/i],
    ["DREAM CARD", /dream\s?card|דרים\s?קארד/i],
    ["תו הזהב", /תו\s?הזהב/i],
    ["תן ביס", /תן\s?ביס|10bis/i],
    ["Gift Card", /gift\s?card/i],
  ];
  const provider = identifyProvider(text);
  const issuer =
    provider.providerIssuer ||
    known.find(([, pattern]) => pattern.test(text))?.[0] ||
    "";
  const name =
    text.match(/(?:שם השובר|שם)\s*:\s*([^\n]+)/)?.[1]?.trim() ||
    provider.productName ||
    issuer ||
    (provider.paymentProvider ? "שובר מולטיפאס — סוג לא מזוהה" : "");
  const stores =
    text
      .match(/(?:חנויות|רשתות)\s*:\s*([^\n]+)/)?.[1]
      ?.split(/[,،;]/)
      .map((s) => s.trim())
      .filter(Boolean) || [];
  const link = safeUrl(extractLinks(text)[0] || "");
  const cashierInstructions =
    text
      .match(
        /הנחיות\s+לקופאי(?:\/ת)?\s*:\s*([^\n]*(?:\n(?!\s*\n)[^\n]*)?)/,
      )?.[1]
      ?.trim() || "";
  const notes =
    text
      .match(/לא\s+(?:תקף|ניתן\s+למימוש)\s+באתרי\s+(?:הסחר|אונליין)[^\n]*/)?.[0]
      ?.trim() || "";
  return {
    name,
    issuer,
    amount: amount ? Number(amount[1].replaceAll(",", "")) : "",
    balance: balance ? Number(balance[1].replaceAll(",", "")) : "",
    code: code?.[1] || "",
    expiry,
    stores,
    link,
    paymentProvider: provider.paymentProvider,
    voucherProductId: provider.voucherProductId,
    cashierInstructions,
    notes,
  };
}
export function redeem(voucher, amount, now = new Date()) {
  const cents = Math.round(Number(amount) * 100);
  const balance = Math.round(voucher.balance * 100);
  if (
    !Number.isFinite(voucher.balance) ||
    !Number.isFinite(cents) ||
    cents <= 0 ||
    cents > balance ||
    statusOf(voucher, now) !== "active"
  )
    throw new Error("יש להזין סכום גדול מאפס ועד היתרה הזמינה, בשובר פעיל.");
  return {
    ...voucher,
    balance: (balance - cents) / 100,
    history: [
      ...(voucher.history || []),
      { id: crypto.randomUUID(), amount: cents / 100, at: now.toISOString() },
    ],
  };
}
export function validateBackup(data) {
  if (
    data?.version !== 1 ||
    !Array.isArray(data.vouchers) ||
    !Array.isArray(data.branches)
  )
    throw new Error("קובץ הגיבוי אינו בפורמט המתאים.");
  const ids = new Set();
  for (const v of data.vouchers) {
    if (
      !v ||
      typeof v.id !== "string" ||
      ids.has(v.id) ||
      typeof v.name !== "string" ||
      !v.name.trim() ||
      (v.amount !== null && (!Number.isFinite(v.amount) || v.amount <= 0)) ||
      (v.balance !== null && !Number.isFinite(v.balance)) ||
      v.balance < 0 ||
      (v.amount !== null && v.amount < v.balance) ||
      !Array.isArray(v.stores) ||
      !v.stores.every((s) => typeof s === "string") ||
      !Array.isArray(v.history) ||
      !v.history.every(
        (h) => h && Number.isFinite(h.amount) && typeof h.at === "string",
      ) ||
      (v.expiry &&
        (typeof v.expiry !== "string" ||
          !/^\d{4}-\d{2}-\d{2}$/.test(v.expiry) ||
          isNaN(new Date(v.expiry)) ||
          new Date(v.expiry).toISOString().slice(0, 10) !== v.expiry))
    )
      throw new Error("פרטי שובר בקובץ הגיבוי אינם תקינים.");
    for (const key of [
      "issuer",
      "code",
      "category",
      "notes",
      "link",
      "image",
      "paymentProvider",
      "voucherProductId",
      "cashierInstructions",
      "storesSourceProductId",
      "storesSourceCheckedAt",
    ])
      if (v[key] != null && typeof v[key] !== "string")
        throw new Error("שדה לא תקין בגיבוי.");
    if (v.image && !/^data:image\/(png|jpeg|webp);base64,/.test(v.image))
      throw new Error("תמונה לא תקינה בגיבוי.");
    ids.add(v.id);
  }
  const branchIds = new Set();
  for (const b of data.branches) {
    if (
      !b ||
      typeof b.id !== "string" ||
      branchIds.has(b.id) ||
      !["store", "city", "address"].every((k) => typeof b[k] === "string") ||
      !Number.isFinite(b.lat) ||
      b.lat < -90 ||
      b.lat > 90 ||
      !Number.isFinite(b.lng) ||
      b.lng < -180 ||
      b.lng > 180
    )
      throw new Error("פרטי סניף אינם תקינים בגיבוי.");
    branchIds.add(b.id);
  }
  return { vouchers: data.vouchers, branches: data.branches };
}
export function distanceKm(a, b) {
  const rad = (x) => (x * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat),
    dLng = rad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}
