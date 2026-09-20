import catalog from "./data/branches.json" with { type: "json" };

// Explicit identities only: online/outlet variants remain separate merchants.
const aliases = [
  ["ללין", "LALINE"],
  ["פוקס", "FOX"],
  ["פוקס הום", "FOX HOME"],
  ["נייק", "NIKE"],
  ["פוט לוקר", "FOOT LOCKER"],
  ["אמריקן איגל", "AMERICAN EAGLE"],
  ["בילבונג", "BILLABONG"],
  ["מנגו", "MANGO"],
  ["מיננה", "MINENE"],
  ["קונברס", "CONVERSE"],
  ["גולף", "GOLF"],
  ["גולף קידס", "GOLF KIDS"],
  ["גולף אנד קו", "GOLF&CO", "GOLF & CO"],
  ["אינטימה", "INTIMA"],
  ["ורדינון", "VARDINON"],
  ["קסטרו", "CASTRO"],
];
const normalize = (name) =>
  name.trim().toLocaleLowerCase().replace(/\s+/g, " ");
export function storeKey(name) {
  const value = normalize(name);
  const group = aliases.find((names) =>
    names.some((n) => normalize(n) === value),
  );
  return group ? normalize(group[0]) : value;
}
export const sameStore = (a, b) => storeKey(a) === storeKey(b);
export function branchesForStores(names, manual = [], shared = catalog) {
  const supported = new Set(names.map(storeKey));
  const seen = new Set();
  return [...manual, ...shared].filter((branch) => {
    if (!supported.has(storeKey(branch.store))) return false;
    const key = `${storeKey(branch.store)}:${branch.lat.toFixed(5)}:${branch.lng.toFixed(5)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
