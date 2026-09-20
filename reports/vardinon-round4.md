# Vardinon collection — 2026-09-20

Official source: https://www.vardinon.co.il/stores?brand=%D7%95%D7%A8%D7%93%D7%99%D7%A0%D7%95%D7%9F

**40 unique Vardinon locations** included from **100 source entries**; **60 records held out**. Coverage remains partial. The official brand-filtered URL is retained verbatim in every candidate and in the source registry candidate.

Each coordinate comes from the branch's explicit `waze://?ll=…&navigate=yes` destination, checked to match the same branch's `data-latitude`/`data-longitude`. No viewport center, inferred geocode, coordinate replacement or swap was used. Official raw Waze links and stable official store IDs are preserved in `scripts/data/vardinon-round4-reviewed.json`. Each candidate includes its address, official source URL, coordinate source URL and check date.

The named city and specific shopping venue or exact street address of every included location were corroborated against previously reviewed official branch records; evidence includes the matching branch ID, address, source URL and distance. Corroborating coordinates were not copied. Names and addresses from Vardinon remain unchanged, including source spelling variations. Afula G at Rabin 18 matches the existing Laline G/Emek Center record; the different E Center venue was not used as corroboration.

Brand separation: the Vardinon site's Vardinon-filtered list returns 100 records. As a read-only cross-check, the official Naaman site's separate `/stores` locator returned 91 records with an entirely different set of numeric IDs. Locations explicitly named as combined Vardinon + Naaman stores in the Vardinon list are emitted only as Vardinon; no Naaman records or voucher eligibility rules are added.

Held out:

- 17 outlet or temporary-fair records require separate review.
- 10 further records share an identical suspicious coordinate (`32.0027879,34.9535803`) across incompatible towns, including Alonim, Ariel, Ashkelon, Hadera, Migdal HaEmek, Yanai, Arad, Petah Tikva, Shoham and Tel Aviv. Other appearances of that same coordinate already fall under the outlet/fair exclusions. No branch was moved to an inferred destination.
- 1 Ofakim GT Center target lies near Rehovot and conflicts with the named city.
- 4 street-number discrepancies remain unresolved: Ashkelon Giron, Givat Shmuel, Ramla Azrieli and Kiryat Ata Gate of the North.
- 1 Netivot Tzim/Globus venue distinction needs verification.
- 26 other records need further venue corroboration.
- 1 additional Karmei Gat record duplicates an already held-out Karmei Gat target; neither was imported.

These 60 are source records, not a claim that 60 additional unique stores remain. No skipped row implies closure, and no existing branch is removed.

Flying Tiger was considered first. Its global locator and Israel search results did not yield usable verified Israel branch coordinates during this bounded check; Vardinon was the authorized fallback. No stale or third-party coordinate source was used.

Reproduction: `node scripts/collect-vardinon-candidates.mjs`. The collector verifies official host, source structure and IDs, exact reviewed fields, Waze destinations, source-coordinate agreement and reviewed count before atomically replacing candidates. A changed/missing reviewed row stops the collection; new rows are held for review. It never writes shared catalogs.

Validation: live collection returned 40 included / 100 examined / 60 held out. In-memory use of the existing merge process produced 40 additions, zero duplicates and zero coordinate-movement alerts. A repeated merge made zero additions or updates. No pair of included Vardinon locations is within 300 meters. Original catalog records remain preserved. Only the parent task performs final combined merge, tests and deployment. No private voucher data was accessed or included.
