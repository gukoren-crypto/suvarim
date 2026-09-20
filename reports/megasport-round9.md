# Mega Sport collection — 2026-09-20

Official source: https://www.megasport.co.il/pages/store-locator

**30 reviewed locations from 65 regular-retail source rows; 35 held out.** The page contained 76 raw cards: ten outlet records and one warehouse for appointment-only pickup were excluded from the regular-retail denominator. All raw excluded records and reasons remain in `scripts/data/megasport-round9-reviewed.json`. This is partial coverage of the observed locator, not a nationwide completeness claim.

The exact tracked identity is `מגה ספורט`. The separately tracked online and kids identities were not merged or given these locations. Outlet and warehouse records were not assumed to have the same retail eligibility. Adding a public branch is not proof of voucher acceptance.

Each included point comes exclusively from that store card's explicit Waze `ll` navigation URL, either the primary navigation button or the explicit navigation link overlaying its map. The iframe viewport is never used as a coordinate source. Raw primary and overlay links are preserved in the baseline. Where both links have explicit coordinates, they agree within their six-decimal rounding precision. The collector rejects larger conflicts. Source URL, coordinate-source URL and check date accompany every candidate. Stable IDs use a SHA-256 prefix of the exact official branch name; a renamed card therefore requires review rather than an automatic new addition.

Every included point was checked against the same named venue and city or exact address in previously reviewed official-source branch data. Evidence includes the supporting branch ID, name, address, source URL and distance. Evidence coordinates were never copied, substituted or averaged. The scope is address/venue-level accuracy, not an exact entrance.

The 35 held-out retail rows comprise:

- 22 needing additional specific-venue or address review.
- 4 with unresolved street-number discrepancies.
- 3 with conflicts between explicit navigation destinations (Glilot, Holon Hamakhtesh, and Kiryat Gat).
- 3 whose destinations conflict with the named venue: Hutzot Hamifratz, Afula G, and Ein Shemer. In particular, the Afula G point is near E Center, a different complex.
- 1 duplicate Bilu destination. The clearer Kiryat Ekron/Bilu Center record is retained; the other record remains in the audit trail.
- 1 duplicate unresolved Tzemach destination; neither Tzemach row was added without venue corroboration.
- 1 malformed Grand Beersheba address that mixes Glilot and Beersheba text.

Ten outlet records and the warehouse remain separately excluded, including a suspicious Ein Hamifratz outlet coordinate near Rishon LeZion. None of these holds/exclusions is evidence of permanent closure. No pre-existing branch was removed.

Reproduction: `node scripts/collect-megasport-candidates.mjs`. The collector fetches the official source, checks record count and unique identities, requires exact reviewed fields and navigation links, applies separate-channel exclusions, and atomically writes its own candidate file only. New/unreviewed IDs remain held out; missing or changed accepted records halt the run.

Validation: live reproduction returned 76 raw /65 examined retail /30 included /35 held /11 separately excluded. In-memory use of the established merge returned 30 additions, zero duplicates and zero movement alerts. All pre-existing rows remained identical; repeating the merge made zero additions or updates. No two included points are within 300 meters. Shared integration, broader tests, commit and publication belong to the parent task. Files contain only public store information.
