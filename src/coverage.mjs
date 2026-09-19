import { getProduct } from "./catalog.mjs";
import { branchesForStores, sameStore, storeKey } from "./branches.mjs";
import registry from "./data/branch-sources.json" with { type: "json" };
import snapshot from "./data/branches.json" with { type: "json" };

export function coverageFor(
  productId,
  sources = registry.sources,
  branches = snapshot,
) {
  const product = getProduct(productId);
  const merchants = [
    ...new Map(
      (product?.merchants || [])
        .filter((m) => m.channel !== "online")
        .map((m) => [storeKey(m.name), m]),
    ).values(),
  ];
  return merchants.map((m) => {
    const source = sources.find(
      (s) =>
        sameStore(s.store, m.name) ||
        s.aliases?.some((a) => sameStore(a, m.name)),
    );
    const locations = branchesForStores([m.name], [], branches);
    const examined = Number.isInteger(source?.examined)
      ? source.examined
      : null;
    const complete =
      source?.coverage === "complete" &&
      examined !== null &&
      examined === locations.length;
    return {
      name: m.name,
      note: source?.note || "",
      mapped: locations.length,
      examined,
      remaining:
        examined === null ? null : Math.max(0, examined - locations.length),
      status: complete
        ? "complete"
        : locations.length
          ? "partial"
          : source
            ? "blocked"
            : "pending",
      sourceUrl: source?.sourceUrl || locations[0]?.sourceUrl || "",
      checkedAt: source?.checkedAt || locations[0]?.checkedAt || "",
    };
  });
}
