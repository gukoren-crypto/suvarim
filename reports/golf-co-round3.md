# GOLF&CO collection — 2026-09-20

Official source: https://www.golfco.co.il/stores

**18 unique candidate locations** from **51 Golf&Co source records**; 33 records remain excluded or need review. The full locator returns 90 entries, of which 39 explicitly named SABON entries belong to a separate brand and are excluded from the Golf&Co coverage denominator. Coverage remains partial; source entries are not a nationwide unique-store count.

Coordinates are the explicit `data-latitude` and `data-longitude` values attached to each official branch entry and its map action. They are not viewport centers or inferred geocodes. Blank coordinate attributes never qualify. Each candidate preserves official name, city, address, per-branch stable numeric ID, official source URL, coordinate source URL and check date. Published IDs are prefixed `golf-co-` to separate Golf&Co from Golf and Golf Kids.

All 18 accepted names and addresses were matched to the same specific venue in previously reviewed catalog data. The corroborating branch IDs, addresses, official source URLs and distances are preserved in `scripts/data/golf-co-round3-reviewed.json`. Corroborating coordinates were not copied. This is a conservative venue review, not a guarantee about an individual shop entrance or voucher acceptance. Star Nahariya and Arena Nahariya use the same Ben Zvi 1 venue address. Street addresses supplied by the source are retained without correction.

Held out:

- 7 records have no explicit coordinates, including the B.S.R outlet, Big Poleg, Gan Shmuel, Big Karmiel, Harel, Kiryat Ono and Seven Stars.
- 2 further records explicitly name outlets (Beersheba Mivne and Beerot Yitzhak); voucher eligibility needs separate review.
- 13 further venues need location corroboration.
- 11 entries have specific coordinate/address concerns: BIG Beersheba; BIG Ashdod pointing near Star Center; two identical Grand Beersheba records; Hadar Jerusalem pointing to Ramot; Star Center Ashdod; Holon pointing to Tel Aviv; Negev Mall; Kiryon street number 92 versus 192 in corroborating official listings; Park Tzameret with opening hours in the address field; and Shviro Kfar Saba with no usable address and a venue-name mismatch. None was corrected or imported. Both duplicate Grand Beersheba entries remain held out.

Other sources investigated: Billabong's official Linktree points to https://www.terminalx.com/bil-stores-open, an address-only branch list in the fetched page. The Children's Place international locator did not yield usable Israel coordinates during this bounded search. The previous SABON locator now redirects to Golf&Co; its current official brand-specific list at https://www.golfco.co.il/stores?brand=sabon supplies branch addresses with empty coordinate attributes. Stale search-engine copies of SABON's old Waze links were not used.

Reproduction: `node scripts/collect-golf-co-candidates.mjs`. The collector checks the official response host, structure, reviewed row fields, explicit coordinates, IDs and reviewed count before replacing candidates atomically. It fails on a missing or changed reviewed location; unreviewed new locations stay in the review queue. It never edits the shared catalogs.

Validation: live collector produced 18 candidates / 51 examined / 33 held out and excluded 39 other-brand entries. In-memory use of the existing merge process returned 18 additions, zero duplicates and zero coordinate-movement alerts. A repeat import made zero additions or updates; no candidate pair in this chain is within 300 meters. All original catalog rows were preserved. The parent task owns final combined review, tests, commit and deployment. No personal voucher data is included.
