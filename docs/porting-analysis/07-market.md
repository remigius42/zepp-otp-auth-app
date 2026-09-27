<!-- spell-checker:ignore Zepp zeus zml nuintun qrcode Amazfit otpauth localStorage settingsStorage jsQR getUserMedia Lisoveliy ZoLArk manujedi typedarrays -->

# 7. Market landscape: OTP apps on Zepp OS

Part of the [porting analysis](./README.md).

**Method, and what each claim rests on.** Every figure below is tagged:
**[repo]** = read from the GitHub API or the repository's own files on
2026-09-09; **[docs]** = quoted from Zepp's developer documentation source;
**[press]** = a single press article, i.e. weakest; **[store]** = observed
directly in the Zepp app's App Store on a paired phone, 2026-09-09;
**[unknown]** = not determinable. No claim here is inferred from plausibility.

There is no public web catalogue of Zepp mini apps — Zepp's own documentation
directs users to the "App Store" section _inside the Zepp app_ — so everything
**[store]** comes from looking, and everything that was **[press]** or
**[unknown]** about the store before that look should be treated as suspect.
Two claims in earlier drafts did not survive it; see §7.1.

## 7.1 Who is in the market

Open-source projects, all figures **[repo]**, read 2026-09-09:

| Repo                                         | License           | ★      | Forks | Created    | Last push  | Enrollment                                                                                                                                                                          |
| -------------------------------------------- | ----------------- | ------ | ----- | ---------- | ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ZoLArk173/Authenticator`                    | MIT               | **31** | 9     | 2022-08-18 | 2025-09-24 | Paste `otpauth://totp/{ACCOUNT}?secret=&issuer=` in Zepp app settings                                                                                                               |
| `manujedi/Authenticator` (fork of the above) | MIT               | **14** | 3     | 2022-12-23 | 2023-03-24 | Same, plus `algorithm` / `digits` / `period`                                                                                                                                        |
| `Lisoveliy/totpfit`                          | **none declared** | 8      | 1     | 2024-11-09 | 2025-08-08 | `otpauth://` with `issuer`/`algorithm`/`digits`/`period`/`offset`; **plus** `otpauth-migration://` bulk import and Proton Authenticator export; add/sort/edit/delete from the phone |
| `UniqueDroid/totp-authenticator-zeppos`      | GPL-3.0           | 0      | 0     | 2026-08-19 | 2026-08-19 | Unknown — README is a one-line stub                                                                                                                                                 |
| `cubimon/zeppos-totp-generator`              | none              | 0      | 0     | 2025-08-29 | 2025-08-29 | Unknown — no README                                                                                                                                                                 |
| `Alpaca131/GTasks`                           | none              | 0      | 0     | 2022-10-19 | 2022-10-19 | Unknown — no README; description reads "An app to show 2FA code on your ZeppOS watch"                                                                                               |

Notes on the table:

- `Lisoveliy/totpfit`'s GitHub repo is a **mirror**; development happens on the
  author's Gitea, and GitHub carries issues only **[repo]**. Its migration
  support is not just a README claim — the tree contains
  `lib/protobuf-decoder/` **[repo]**.
- `Alpaca131/GTasks` is _not_ a predecessor of the ZoLArk app — it was created
  two months **after** it. `manujedi`'s README credits "ZoLArk173 and Alpaca131
  for the idea and original code", which is the only established link **[repo]**.
- `ZoLArk173`'s README lists its own limitations verbatim: "Cannot rearrange 2FA
  codes. Cannot import URI without manual edit. Won't auto update every 30
  secs." **[repo]**

**Store listings: five, all third-party, publishers shown.** Observed directly in
the Zepp app's App Store on 2026-09-09 **[store]**, searching "Authenticator":

| Listing            | Publisher | Dated      | Also on GitHub (§7.1)?          |
| ------------------ | --------- | ---------- | ------------------------------- |
| Authenticator      | galulex   | 2026-08-01 | no                              |
| TOTP Authenticator | manujedi  | 2023-01-29 | yes — confirms its README claim |
| AMGTOTP            | leen      | 2026-05-30 | no                              |
| Auth               | Tachanka  | 2023-09-28 | no                              |
| TOTPFit            | Lisoveliy | 2025-08-28 | yes                             |

**This refutes two things earlier drafts of this report asserted.**

1. **There is no first-party Zepp Health authenticator.** The Notebookcheck
   article's "Zepp Health also notes that the Authenticator Mini App has been
   revamped" **[press]** does not correspond to a Zepp-published listing. The
   nearest match by date is **galulex's "Authenticator" (2026-08-01)** — a
   third-party app that Zepp appears to have promoted. Zepp _announcing_ an app
   is not Zepp _writing_ one, and this report twice built inferences on the gap.
2. **Publishers are shown.** §7.1 previously warned that attribution "may not be
   displayed at all" and treated it as possibly unanswerable. It is displayed,
   with dates, for every listing.

**Consequence, and it strengthens §4.2:** the privileged-camera-access
hypothesis is dead. Every authenticator in this ecosystem — store and GitHub
alike — is third-party and bound by the same Settings App component set. Nobody
has a QR path we lack that we could not build ourselves — and per §4.2, we
can build it. See `ADR-0001`.

**Also: the field is larger than §7.1's GitHub survey suggested.** Three of the
five listings — galulex, leen, Tachanka — have no repository in that table, so
the six open-source projects were an undercount of the competitive field, though
not of the _inspectable_ one. Whether any of them is polished is still
**[unknown]**; only their existence is established.

**What can be said with confidence:** six open-source projects exist; only two
have any traction (31 and 14 stars); the most-starred self-describes as a
prototype; the fork that reached the store was last touched in March 2023, in
the Zepp OS 2 era. Among _inspectable_ competitors there is no polished
alternative. The store side is not inspectable from here.

## 7.2 Paid vs. free, and the price ceiling

All of the following is **[docs]**, quoted from `docs/guides/faq/paid-app.md` in
`zepp-health/zeppos-docs`:

- "Only certified corporate developers in Mainland China can submit paid Mini
  Programs or Watchfaces in the Zepp Store, and their works can be listed in
  Zepp Stores outside of Mainland China." Becoming one requires contacting Zepp
  OS staff via the developer community.
- Three tiers only: **$1.99 / $2.99 / $3.99** (€1.99 / €2.99 / €3.99).
- "Zepp Health's service fee for developers is 15%, and after deducting the 30%
  commission that Apple or Google takes for in-app purchases, the developer can
  receive a revenue of 100% - 15% - 30% = **55%**."
- "Zepp OS allows developers to use reasonable in-app purchase solutions for
  Mini Programs, such as Kiezelpay or other QR code reward schemes, and the
  payment method must be explained at the time of app submission."
- On paid watch faces from outside Mainland China: "This method is currently not
  supported by the official channel."

Consequences: as a Swiss developer you **cannot list a paid app or watch face
through the official channel**. The realistic options are free, or free with a
Kiezelpay unlock. The six open-source projects are free (they are source
repositories with no payment mechanism) **[repo]**; the store listing's price is
**[unknown]**.

## 7.3 How the field handles the QR problem

**None of the six open-source projects scans a QR code** — every one pastes a
URI **[repo]**. That independently supports §4.2. It is a statement about the
projects that can be inspected; the store listing's flow is **[unknown]**.

The most capable enrollment is TOTPFit's, per its own guide
(`docs/guides/how-to-add-totps/README.md`) **[repo]**:

1. **Single tokens** — "scan QR-Code of service providing 2FA and scan (decode)
   it to a URI", using an image-scanning app; the guide names **Google Lens**.
   Copy the URI, paste it via "Add new TOTP record". Same cloud-upload caveat as
   §4.5.
2. **Google Authenticator bulk import** — "Transfer accounts" → "Export
   accounts", screenshot the QR, decode it to an `otpauth-migration://offline?
data=…` URI, paste once, and all selected records import together.
3. **Proton Authenticator** — export, open the file in a text editor, paste the
   contents.

So the ecosystem's answer to "no camera, no image picker" is **bulk import**
rather than per-token scanning: pay the paste tax once per vault instead of once
per account.

**This is the most valuable feature gap to close.** Google Authenticator's
export payload is base64-wrapped protobuf, and TOTPFit demonstrates it is
tractable on this platform — its tree carries a hand-rolled
`lib/protobuf-decoder/` **[repo]**. Estimate **4–6 h** including tests
(my estimate, not a measured figure), no platform risk. It would beat every
inspectable competitor's enrollment UX and soften the loss of the `ImagePicker`
flow. Not in the §5 totals; recommended as a scoped addition.

## 7.4 Ratings

**Still [unknown].** The store search surfaced names, publishers and dates
(§7.1) but no ratings, review counts or install counts. There is no public web
catalogue either, so the only public proxy remains the GitHub star counts in
§7.1 — an ecosystem where 31 stars is the leader, and where three of the five
store listings have no public repository at all.

What the store _did_ settle is that the field is at least five apps deep rather
than the two-with-traction §7.1 implied. That is a mild argument against the
"the field is thin, so build" reasoning — though §8.4 rests the build decision on
wanting the porting experience, not on market gap, so it does not change the
conclusion.
