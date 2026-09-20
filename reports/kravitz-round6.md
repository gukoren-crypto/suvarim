# Kravitz collection — 2026-09-20

Official locator: https://www.kravitz.co.il/pages/store-locator

**28 unique Kravitz locations** included from **72 public source records**; **44 records held out**. Coverage remains partial.

The official Kravitz page embeds `<stockist-store-locator data-stockist-widget-tag="map_pqkngpy3">`. This public widget identifier connects the retailer to the Stockist service; it is not a private credential. The association, widget configuration URL and public coordinate-response URL are preserved in `scripts/data/kravitz-round6-reviewed.json`. No authentication, cookies, session tokens or request headers were saved.

Public coordinate source: https://stockist.co/api/v1/map_pqkngpy3/locations/search?latitude=32&longitude=35&distance=50000

The query center (`32,35`) is used only to request locator records. Each candidate's coordinates are taken exclusively from its own returned `latitude` and `longitude` fields, not from that search center or from the widget's initial map viewport. The official widget configuration permits 100 results with a maximum distance setting of 50000; this request returned 72 rows, below that cap. This is the observed response scope, not proof that all nationwide branches are present. The collector stops on a capped response or one smaller than the reviewed baseline.

Each candidate uses the retailer's own branch-detail URL as `sourceUrl` and the exact public Stockist endpoint as `coordinateSourceUrl`, with the check date and a stable `kravitz-` ID based on Stockist's persistent location ID. All 28 detail pages were fetched successfully from the official Kravitz host; their branch names were checked. Tel Aviv Azrieli uses the heading “קניון עזריאלי תל אביב” instead of the locator wording “קרביץ עזריאלי תל אביב”. The individual pages contain Waze links, sometimes opaque venue IDs or incomplete links; they were not used to invent coordinates.

All included locations were checked against the same named venue and city, or the same exact address, in previously reviewed official branch data. Supporting IDs, names, addresses, source URLs and distances are stored in the reviewed baseline. Those coordinates were corroboration only and were never copied or substituted. Addresses and city fields remain as supplied by Kravitz. Accuracy is venue-level and does not claim an exact shop entrance or voucher eligibility.

Held out:

- 28 records need further specific-venue corroboration, including city/region labels that need more review.
- 10 have coordinate or address conflicts with the named venue: Avnat Petah Tikva, Shaar Rishon, Malha, Maale Adumim, BIG Ashdod, Karmei Gat, BIG Yokneam, Afula G, one Negev Mall record, and Grand Beersheba.
- 3 lack an address: BIG Glilot, Ariel, and Ben Gurion. Their coordinates are also suspicious and no fallback address was inferred.
- 2 have missing or inconsistent city information (Ir Yamim and Bilu Center).
- 1 has an unresolved street-number discrepancy (Givat Shmuel).

The locator contains two Negev Mall records. The entry whose own coordinate agrees with the named mall is included; the other entry points several kilometers away and is held out. There is no duplicate included marker. The Afula Rabin 18 entry points near E Center, a different venue, and was excluded. None of these exclusions is a statement that a shop closed.

Reproduction: `node scripts/collect-kravitz-candidates.mjs`. The collector verifies the official page-to-widget association, widget configuration, response scope, IDs, exact reviewed fields and coordinates before atomically replacing candidates. Missing or changed reviewed rows halt the run; newly appearing IDs stay in the review queue. Shared catalogs are never written by the collector.

Validation: live collection returned 28 included / 72 examined / 44 held out. In-memory use of the existing merge process returned 28 additions, zero duplicates and zero coordinate-movement alerts. Repeating the merge made no additions or updates. No pair of included Kravitz locations lies within 300 meters. All pre-existing catalog rows remain preserved. Final combined review, tests, commit and publication belong to the parent task. These files contain public branch information only.
