# Naaman collection — 2026-09-20

Official source: https://www.naamanp.co.il/stores

**28 unique Naaman locations** included from **91 source entries**; **63 records held out**. The chain is stored as **נעמן פורצלן**, matching the existing Swish catalog. Coverage remains partial; the 63 held-out records are not a nationwide unique-store deficit.

Each coordinate comes from the Naaman branch's own explicit `waze://?ll=…&navigate=yes` destination, checked to agree with that same row's `data-latitude` and `data-longitude`. Raw Waze links and stable numeric official store IDs are preserved in `scripts/data/naaman-round5-reviewed.json`. Each candidate includes the official name, city, address, source URL, coordinate-source URL and verification date. Published IDs use the `naaman-` prefix.

All 28 accepted points were reviewed for the named city and specific venue or street address against existing reviewed official branches. Evidence records include the corroborating branch ID, name, address, source URL and distance. Corroborating coordinates were not copied or substituted. Naaman's Ashkelon Giron address is Ben Gurion 21 and its Ramla Azrieli address is David Raziel 1; these agree with corroborating records, unlike the differently numbered Vardinon entries held out in the previous round. The wider mall destinations at Holon, Grand Haifa and Ayalon remain the unchanged Naaman targets; accuracy is venue-level rather than an exact entrance claim.

The source is Naaman's own official locator. Explicitly combined Vardinon + Naaman shops in that locator are emitted only as Naaman. Existing Vardinon records remain a separate brand even at shared premises; no voucher eligibility or other-brand records are added by this collector.

Held out:

- 16 outlet or temporary-fair records.
- 10 further records use the identical suspicious `32.0027879,34.9535803` target across incompatible towns. Other appearances already fall under the outlet/fair exclusions.
- 1 Ofakim GT Center target points near Rehovot.
- 2 destinations conflict with the named venue and need further review: BIG Yokneam and Marom Naveh in Ramat Gan.
- 6 address or street-number discrepancies: Givat Shmuel, Modiin Azrieli, Kiryon, Gate of the North, Shaar Rishon, and Bialik Ramat Gan.
- 1 Netivot Tzim/Globus venue distinction.
- 26 other records need further specific-venue corroboration.
- 1 additional Karmei Gat record duplicates an already held-out Karmei Gat destination; neither was imported.

No excluded entry implies closure. No coordinates were inferred, swapped, corrected or copied from Vardinon. Existing catalog records were untouched.

Reproduction: `node scripts/collect-naaman-candidates.mjs`. The collector checks the official hostname, source structure and IDs, exact reviewed fields, Waze destinations, agreement with per-branch coordinate attributes and reviewed count. A missing or changed reviewed row stops the run before atomically replacing candidates; new rows are held for review. The collector never writes shared catalogs.

Validation: live collection returned 28 included / 91 examined / 63 held out. The existing merge function, used in memory, produced 28 additions, zero duplicates and zero coordinate-movement alerts. Repeating the merge made zero additions or updates. No pair of included Naaman locations lies within 300 meters. Original catalog records remain preserved. Final combined merge, tests, commit and publication are owned by the parent task. The files contain public branch data only.
