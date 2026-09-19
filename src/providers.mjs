// Public product information only. Never put personal voucher URLs or codes here.
export const SWISH_PREMIUM = {
  id: "swish-premium",
  name: "Swish Premium (Rainbow)",
  issuer: "Swish",
  sourceUrl: "https://swish.co.il/benefitPage/104068?isInformative=true",
  checkedAt: "2026-09-19",
  terms: [
    "המוצר נקרא בעבר נופשונית Rainbow.",
    "העמוד הציבורי מציין תוקף של חמש שנים מהרכישה. את תאריך התפוגה האישי יש לבדוק בכרטיס.",
    "יש לבדוק חריגים לכל עסק: בין היתר עודפים, הטבות וצבירת נקודות מועדון ומימוש אונליין.",
    "רשימת העסקים עשויה להשתנות; יש לבדוק אותה בעמוד הרשמי לפני המימוש.",
  ],
};

export function extractLinks(raw) {
  const text = String(raw || "")
    .replaceAll("&amp;", "&")
    .replace(
      /(https?:\/\/mycards\.mltp\.co\.il\/)\s*\n\s*([A-Za-z0-9_-]+)/g,
      "$1$2",
    );
  const markdown = [
    ...text.matchAll(/\[[^\]]*\]\((https?:\/\/[^\s)]+)\)/g),
  ].map((m) => m[1]);
  const bare =
    text
      .replace(/\[[^\]]*\]\((https?:\/\/[^\s)]+)\)/g, " ")
      .match(/https?:\/\/[^\s<>\[\]()"']+/g) || [];
  return [
    ...new Set(
      [...markdown, ...bare].map((link) => link.replace(/[.,;!?]+$/, "")),
    ),
  ];
}

export function identifyProvider(raw) {
  const text = String(raw || "").normalize("NFKC");
  const links = extractLinks(text).flatMap((link) => {
    try {
      return [new URL(link)];
    } catch {
      return [];
    }
  });
  const hostMatches = (url, domain) =>
    url.hostname === domain || url.hostname.endsWith(`.${domain}`);
  // URL contents are opaque tokens. Only use the hostname and known PUBLIC product routes.
  const words = text.replace(/https?:\/\/[^\s<>]+/g, " ");
  const swish =
    links.some((url) => hostMatches(url, "swish.co.il")) ||
    /\bswish\b|סוויש|סויש/i.test(words);
  const mentionsOtherSwish =
    /\bswish\s+(?:plus|baby|fashion|breakfast|omg|theatre|hotels|dine)\b/i.test(
      words,
    );
  const premium =
    !mentionsOtherSwish &&
    (/\bswish\s+premium\b|(?:סוויש|סויש)\s+פרימיום|נופשונית\s+rainbow/i.test(
      words,
    ) ||
      links.some(
        (url) =>
          hostMatches(url, "swish.co.il") &&
          /^\/(?:benefitPage\/104068|home\/[^/]+\/product-104068)\/?$/i.test(
            url.pathname,
          ),
      ));
  const dream =
    /\bdream\s?card\b|דרים\s?קארד/i.test(words) ||
    links.some((url) =>
      ["dcgift.co.il", "dreamcard.co.il", "dreamgiftcard.co.il"].some(
        (domain) => hostMatches(url, domain),
      ),
    );
  const multipass =
    /מולטי\s?פאס|\bmultipass\b/i.test(words) ||
    links.some(
      (url) =>
        hostMatches(url, "mltp.co.il") || hostMatches(url, "multipass.co.il"),
    );
  const dreamInclude =
    !swish &&
    links.some(
      (url) =>
        hostMatches(url, "dcgift.co.il") &&
        /^\/include\/?$/i.test(url.pathname),
    );
  return {
    voucherProductId: premium
      ? SWISH_PREMIUM.id
      : dreamInclude
        ? "dreamcard-multipass-include"
        : "",
    productName: premium
      ? SWISH_PREMIUM.name
      : dreamInclude
        ? "DREAM CARD — מולטיפאס, כולל כפל מבצעים"
        : "",
    providerIssuer: swish || premium ? "Swish" : dream ? "DREAM CARD" : "",
    paymentProvider: multipass || dreamInclude ? "מולטיפאס" : "",
  };
}
