import { validateBackup, distanceKm } from "../../src/domain.mjs";
import { storeKey } from "../../src/branches.mjs";
const url = (value) => {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
};
const locationKey = (b) =>
  `${storeKey(b.store)}:${b.lat.toFixed(5)}:${b.lng.toFixed(5)}`;
export function mergeBranchCandidates(existing, registry, candidates) {
  validateBackup({ version: 1, vouchers: [], branches: existing });
  const rows = new Map(existing.map((b) => [b.id, { ...b }]));
  const sources = new Map(
    registry.sources.map((s) => [storeKey(s.store), { ...s }]),
  );
  const seenStores = new Set(),
    report = {
      added: [],
      updated: [],
      duplicates: [],
      reviewRequired: [],
      retained: [],
      chains: [],
    };
  for (const candidate of candidates) {
    const { store, branches, source } = candidate;
    if (
      typeof store !== "string" ||
      !store.trim() ||
      source?.store !== store ||
      !Array.isArray(branches) ||
      !url(source.sourceUrl)
    )
      throw Error("Invalid candidate/source");
    const identity = storeKey(store);
    if (seenStores.has(identity))
      throw Error(`Duplicate candidate chain: ${store}`);
    seenStores.add(identity);
    validateBackup({ version: 1, vouchers: [], branches });
    if (
      !Number.isInteger(source.examined) ||
      source.examined < branches.length ||
      !/^\d{4}-\d{2}-\d{2}$/.test(source.checkedAt) ||
      !Array.isArray(source.skipped)
    )
      throw Error(`Invalid source coverage: ${store}`);
    const incomingIds = new Set(branches.map((b) => b.id));
    const oldChain = existing.filter((b) => storeKey(b.store) === identity);
    for (const b of branches) {
      if (
        b.store !== store ||
        !url(b.sourceUrl) ||
        !url(b.coordinateSourceUrl) ||
        !/^\d{4}-\d{2}-\d{2}$/.test(b.checkedAt) ||
        b.lat < 29 ||
        b.lat > 34 ||
        b.lng < 34 ||
        b.lng > 36.5
      )
        throw Error(`Invalid branch provenance: ${b.id}`);
      const old = rows.get(b.id);
      if (old && storeKey(old.store) !== identity)
        throw Error(`ID belongs to another chain: ${b.id}`);
      if (old && distanceKm(old, b) > 0.15) {
        report.reviewRequired.push({
          id: b.id,
          store,
          name: b.name,
          reason: "coordinate-moved-over-150m",
          previous: { lat: old.lat, lng: old.lng },
          proposed: { lat: b.lat, lng: b.lng },
        });
        continue;
      }
      const duplicate = [...rows.values()].find(
        (r) => r.id !== b.id && locationKey(r) === locationKey(b),
      );
      if (duplicate) {
        report.duplicates.push({
          id: b.id,
          existingId: duplicate.id,
          store,
          name: b.name,
        });
        continue;
      }
      if (!old)
        report.added.push({ id: b.id, store, name: b.name, city: b.city });
      else if (JSON.stringify(old) !== JSON.stringify(b))
        report.updated.push({ id: b.id, store, name: b.name });
      rows.set(b.id, { ...b });
    }
    const retained = oldChain.filter((b) => !incomingIds.has(b.id));
    report.retained.push(
      ...retained.map((b) => ({
        id: b.id,
        store,
        name: b.name,
        reason: "absent-from-partial-batch-not-deleted",
      })),
    );
    const included = [...rows.values()].filter(
      (b) => storeKey(b.store) === identity,
    ).length;
    if (included > source.examined)
      throw Error(`Source scope smaller than retained catalog: ${store}`);
    const complete =
      source.coverage === "complete" &&
      included === source.examined &&
      !source.skipped.length &&
      !retained.length;
    sources.set(identity, {
      ...source,
      included,
      coverage: complete ? "complete" : included ? "partial" : "blocked",
      retainedFromPrevious: retained.length,
    });
    report.chains.push({
      store,
      examined: source.examined,
      included,
      retained: retained.length,
    });
  }
  const branches = [...rows.values()];
  validateBackup({ version: 1, vouchers: [], branches });
  return {
    branches,
    registry: { ...registry, sources: [...sources.values()] },
    report,
  };
}
