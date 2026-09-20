# Steimatzky collection — 2026-09-20

Official locator: https://www.steimatzky.co.il/storelocator

**46 unique Steimatzky locations** included from **136 official locator records**; **90 records held out**. Coverage remains partial. This is one bounded collection round, not a nationwide completeness claim.

Tzomet Sfarim was investigated first. Its official Booknet branch list and the Ichilov branch detail page returned addresses without an explicit coordinate-bearing navigation destination in the inspected HTML. No geocoding was inferred. This limited inspection does not establish that every Booknet page lacks coordinates; Steimatzky was used as the authorized fallback.

Each included Steimatzky record has its own explicit `waze:` destination with `ll` and `navigate=yes`, agreeing exactly with that row's `data-latitude` and `data-longitude`. Raw links and source fields are preserved in `scripts/data/steimatzky-round7-reviewed.json`. Both provenance URLs point to the official locator that supplies those destinations. Candidates include the check date and stable `steimatzky-` IDs based on the locator's numeric store ID.

All 46 included destinations were reviewed against the same named venue and city, or the exact address, in previously reviewed official-source branch data. Supporting branch IDs, addresses, source URLs and distances are preserved in the baseline. That evidence corroborates the venue only: every candidate retains its own Steimatzky coordinates. Ashdod Star Center was checked against the existing Vardinon entry at Jabotinsky 43, matching the official Steimatzky address. No coordinates were copied or substituted. Accuracy is address or venue level, not an exact shop entrance or proof of voucher eligibility.

Held out:

- 64 records need further specific-venue review.
- 10 have a coordinate conflict with the named venue, including Meir Hospital pointing near Rehovot, Afula G pointing near E Center, and other mismatched malls or addresses.
- 7 have an unresolved street-number or address discrepancy.
- 5 airport records need access and duplicate review, including overlapping Ben Gurion destinations and Ramon Airport.
- 2 are marked as wholesale branches and need separate eligibility review.
- 1 is explicitly the head office with no pickup.
- 1 lacks an explicit coordinate.

The official locator's open/closed-at-this-time CSS was not interpreted as permanent closure. Excluded or unreviewed records were not treated as closed, and this collector does not delete existing locations.

Reproduction: `node scripts/collect-steimatzky-candidates.mjs`. The collector verifies the official response host, source record count, unique IDs, exact reviewed fields, per-row coordinate agreement and destination bounds before atomically writing its candidate file. Missing or changed reviewed rows halt collection; new IDs enter the review queue. Shared catalogs are never written by this collector.

Validation: live collection returned 46 included / 136 examined / 90 held out. In-memory use of the existing candidate merge returned 46 additions, zero duplicates and zero coordinate-movement alerts. A second merge produced zero additions or updates. No pair of included Steimatzky locations lies within 300 meters. All existing catalog rows were preserved. Final combined review, tests, commit and publication belong to the parent task. These files contain only public branch information.
