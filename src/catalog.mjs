import snapshot from "./data/swish-premium.json" with { type: "json" };
import { SWISH_PREMIUM } from "./providers.mjs";

const all = [
  "FOX",
  "FOX HOME",
  "AMERICAN EAGLE",
  "NIKE",
  "FOOT LOCKER",
  "LALINE",
  "MANGO",
  "AERIE",
  "CONVERSE",
  "SACK'S",
  "שילב",
  "BILLABONG",
  "THE CHILDREN'S PLACE",
  "QUIKSILVER",
  "FLYING TIGER",
  "SUNGLASS HUT",
  "JUMBO",
  "ITAY BRANDS",
  "MINENE",
  "RUBY BAY",
];
const withoutSales = [
  "FOX",
  "FOX HOME",
  "AMERICAN EAGLE",
  "LALINE",
  "MANGO",
  "THE CHILDREN'S PLACE",
  "AERIE",
  "BILLABONG",
  "BOARDRIDERS",
  "QUIKSILVER",
  "YANGA",
  "RUBY BAY",
];
const merchants = (names) =>
  names.map((name) => ({ name, category: "", channel: "listed" }));
const payboxTerms = [
  "הרשימה מתייחסת למסלול פייבוקס / מולטיפאס שבמקור; יש להתאים אותו לכרטיס שלך.",
  "קיימות מגבלות על עודפים, מוצרי השקה והטבות מועדון. מימוש אונליין מוגבל לרשתות המפורטות בתקנון.",
];
const praxellTerms = [
  "הרשימה מתייחסת לכרטיס דיגיטלי של פרקסל בלבד. קידומת הקוד אינה מספיקה לזיהוי ללא סוג הכרטיס.",
  "קיימות מגבלות על עודפים והטבות מועדון; תנאי המבצעים והאונליין תלויים בגרסת הכרטיס.",
];
export const products = [
  {
    id: "dreamcard-multipass-include",
    name: "DREAM CARD — מולטיפאס, כולל כפל מבצעים",
    issuer: "DREAM CARD",
    sourceUrl: "https://www.dcgift.co.il/include",
    checkedAt: "2026-09-19",
    merchants: merchants(all),
    terms: [
      "המסלול מזוהה לפי קישור התקנון include שצורף לשובר.",
      "העמוד מתיר מבצעים לציבור הרחב, עם חריגים למועדון, עודפים ומוצרי השקה.",
      "העמוד הציבורי מאפשר אונליין ברשתות מסוימות. אם בהודעה האישית נכתב אחרת, יש לברר מול המנפיק לפני מימוש אונליין.",
    ],
  },
  {
    ...SWISH_PREMIUM,
    checkedAt: snapshot.checkedAt.slice(0, 10),
    merchants: snapshot.merchants,
  },
  ...[
    ["all", "ALL", all],
    ["sport", "SPORT", ["NIKE", "FOOT LOCKER", "CONVERSE", "BILLABONG"]],
    ["baby", "BABY", ["FOX", "THE CHILDREN'S PLACE", "MINENE", "שילב"]],
  ].map(([id, label, names]) => ({
    id: `dreamcard-paybox-${id}`,
    name: `DREAM CARD ${label} — פייבוקס / מולטיפאס`,
    issuer: "DREAM CARD",
    sourceUrl: "https://www.dcgift.co.il/paybox",
    checkedAt: "2026-09-19",
    terms: payboxTerms,
    merchants: merchants(names),
  })),
  ...[
    ["sales", "פרקסל, כולל מבצעים (8765)", all],
    ["no-sales", "פרקסל, ללא מבצעים (1234)", withoutSales],
  ].map(([id, label, names]) => ({
    id: `dreamcard-praxell-${id}`,
    name: `DREAM CARD — ${label}`,
    issuer: "DREAM CARD",
    sourceUrl: "https://www.dcgift.co.il/dream-card-digital",
    checkedAt: "2026-09-19",
    terms: praxellTerms,
    merchants: merchants(names),
  })),
];
export const getProduct = (id) => products.find((p) => p.id === id);
export function clearCatalogAssociation(fields) {
  const previous = getProduct(fields.storesSourceProductId);
  if (!previous)
    return { ...fields, storesSourceProductId: "", storesSourceCheckedAt: "" };
  const imported = new Set(previous.merchants.map((m) => m.name));
  return {
    ...fields,
    stores: fields.stores
      .split(/[,\n;]/)
      .map((s) => s.trim())
      .filter((s) => s && !imported.has(s))
      .join(", "),
    storesSourceProductId: "",
    storesSourceCheckedAt: "",
  };
}
export function applyCatalog(fields) {
  const product = getProduct(fields.voucherProductId);
  if (!product) throw new Error("יש לבחור סוג שובר לפני הוספת חנויות.");
  return {
    ...fields,
    issuer: product.issuer,
    stores: [
      ...new Set([
        ...fields.stores
          .split(/[,\n;]/)
          .map((s) => s.trim())
          .filter(Boolean),
        ...product.merchants.map((m) => m.name),
      ]),
    ].join(", "),
    storesSourceProductId: product.id,
    storesSourceCheckedAt: product.checkedAt,
  };
}
export function merchantIndex(vouchers) {
  const result = new Map();
  for (const voucher of vouchers) {
    const product = getProduct(voucher.storesSourceProductId);
    if (!product) continue;
    const included = new Set(voucher.stores);
    for (const merchant of product.merchants) {
      if (!included.has(merchant.name)) continue;
      const existing = result.get(merchant.name);
      result.set(merchant.name, {
        ...merchant,
        categories: [
          ...new Set(
            [...(existing?.categories || []), merchant.category].filter(
              Boolean,
            ),
          ),
        ],
        channel:
          existing && existing.channel !== merchant.channel
            ? "listed"
            : merchant.channel,
        sourceUrl: product.sourceUrl,
      });
    }
  }
  return result;
}
