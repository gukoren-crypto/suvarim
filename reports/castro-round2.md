# CASTRO collection — 2026-09-20

Official source: https://www.castro.com/stores

75 public locator records examined, **43 unique candidate locations included**, 32 source records held out. Coverage is partial; 75 is a locator-record count, not a count of unique nationwide stores. Department entries often share a venue.

Coordinates come exclusively from explicit `waze://?ll=…&navigate=yes` destination links within the official locator. `coordinateSourceUrl` points to that official page; the original Waze destination and official store ID are preserved in `scripts/data/castro-round2-reviewed.json`. No viewport coordinates or inferred geocoding are used. Each included candidate preserves the official name, city and address, source URL and check date. Stable IDs use the official locator's numeric store identifier.

Review cross-checked the named city and shopping venue against already reviewed catalog locations. Only the conservative reviewed set was accepted. Those supporting records are corroboration only: their coordinates were never substituted for CASTRO's own navigation destination. Uncertain venues remain excluded, rather than being automatically corrected.

Held out:

- 11 redundant department entries: 9 share an exact destination with an included department; 2 at the same Holon/Modiin venue have nearby department targets. One marker per chain/venue is retained. The retained name continues to identify its original source entry and does not assert department or voucher eligibility.
- 3 OUTLET locations: Bilu, Hutzot Hamifratz and Herzliya; eligibility needs separate review.
- 1 employees-only headquarters shop in Bat Yam.
- 1 suspicious Negev Mall destination (`4073`): it lies near BIG Beer Sheva's official destination rather than the named Negev Mall. Not corrected or imported.
- 1 Afula G / Emek Center record (`4103`): the nearest existing Foot Locker record names E Center at Yosef Barzilai 5, while CASTRO names Emek Center at Yitzhak Rabin 18. Proximity alone cannot resolve the venue distinction; held out for review.
- 15 records whose exact venue needs further review, including both department records in Upper Galilee and Kiryat Gat, Kiryat Ata, Kastina, Beit Shemesh, Jaffa, Rogovin Netanya, Yavne, Dimona, Sirkin, Ramla, Kanyoter and Shefa-Amr. These are not claims of closure or erroneous coordinates.

Reproduction: `node scripts/collect-castro-candidates.mjs`. An optional `--html <downloaded-locator.html>` supports local parser review with the baseline check date. Changes to reviewed names, addresses, city or navigation target cause the collector to fail before replacing candidates. New IDs stay in the review queue. An incomplete locator or missing reviewed location similarly leaves the previous file intact.

Validation: online collector returned 75 examined / 43 included / 32 skipped. In-memory use of the existing candidate merge function returned 43 additions, zero duplicates and zero coordinate-movement review alerts. A second identical import returned zero additions and zero updates. No shared catalog, publication, or personal-wallet files were edited by this collector.

Other sources considered in this round: the existing MANGO coverage record documents blocked coordinates; current public search also indicates an incomplete Israel locator. MINENE's official https://www.minene.net/storelocator provides addresses and mixes chain stores with independent resellers, but the fetched locator had no explicit navigation destinations or coordinates. Neither source was used to guess new coordinates; both remain work for a future round.
