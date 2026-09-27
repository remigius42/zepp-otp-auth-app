<!-- spell-checker:ignore Zepp zeus zml nuintun qrcode Amazfit otpauth localStorage settingsStorage jsQR getUserMedia Lisoveliy ZoLArk manujedi typedarrays -->

# 8. Reach and maintenance cost

Part of the [porting analysis](./README.md).

All device figures **[docs]**, from Zepp's device list, read 2026-09-09.

## 8.1 How many devices, how many generations

Zepp's list carries **34 devices**. By API_LEVEL — the only compatibility axis
that matters, since Zepp OS firmware versions and API levels are decoupled:

| API_LEVEL          | Devices | Which                                                                                                                                                                  |
| ------------------ | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| none (Zepp OS 1.0) | 5       | GTR 3, GTR 3 Pro, GTS 3, GTS 4 mini, Band 7 — predate API_LEVEL; effectively out of scope                                                                              |
| 2.0 – 3.0          | 4       | GTR Mini, Bip 5, Bip 5 Unity, T-Rex 2                                                                                                                                  |
| 3.5 – 3.7          | 10      | GTR 4, GTS 4, Cheetah (round/square/Pro), T-Rex Ultra, Falcon, Balance, Active, Active Edge                                                                            |
| 4.0 – 4.4          | 15      | Active 2 (round + square), Balance 2 / 3 / Ultra, T-Rex 3, T-Rex 3 Pro (44 + 48), T-Rex Ultra 2, Bip 6, Bip Max, Cheetah 2 (Pro + Ultra), Active Max, Active 3 Premium |

Targeting **API_LEVEL ≥ 3.6** — the floor for `@zeppos/zml` — reaches **24 of
the 34 devices**, spanning about four hardware generations.

But porting effort does not scale with device count; it scales with **screen
geometry**, because layout is absolute-positioned (§3). Among those 24:

| Layout                                                                                                                         | Devices ≥ 3.6 | Cumulative |
| ------------------------------------------------------------------------------------------------------------------------------ | ------------- | ---------- |
| Round 466 × 466 — **Active 2 Round**, GTR 4, Cheetah 2 Pro, T-Rex 3 Pro 44 mm, Active 3 Premium                                | 5             | 5          |
| Round 480 × 480 — Balance / 2 / 3 / Ultra, T-Rex 3, T-Rex 3 Pro 48 mm, T-Rex Ultra 2, Cheetah Pro, Cheetah 2 Ultra, Active Max | 10            | 15         |
| Square 390 × 450 — Active 2 Square, Bip 6, Active, Cheetah Square, GTS 4                                                       | 5             | 20         |
| Round 454 × 454 (2), round 416 × 416 (1), square 432 × 514 (1)                                                                 | 4             | 24         |

So the **first layout is nearly free reach for five devices**, a second layout
(480 round) reaches 15, and a third (390 × 450 square) reaches 20 of 24. This is
the strongest argument in the report for doing the port at all: the marginal
cost per additional device is close to zero within a resolution class.

## 8.2 Is the API churn as bad as it looks?

**Largely no, and the evidence points the other way [docs].** Zepp documents an
explicit compatibility contract: API_LEVEL "is the version number of Zepp OS's
open capabilities"; "higher version API_LEVEL is fully compatible with lower
version applications"; developers "don't need to track firmware or OS version
numbers, only adapt to API_LEVEL". Levels 2.0 → 4.4 have been **additive**.

The one real discontinuity was **1.0 → 2.0** (ESM modules, `hmUI`/`hmFS` → the
`@zos/*` namespace, new storage and BLE messaging), and it is four years old.
Zepp even ships a migration tool (`@zeppos/zmt`) for it.

That reframes §7.1: the abandoned competitors are not evidence of continuous
churn. `manujedi/Authenticator`'s README is a fossil of that single 1.0 → 2.0
migration — "changed to Zepp OS 2", "New storage API from 2.0" — after which the
author stopped in March 2023 **[repo]**. The rot is one historic break plus
abandonment, not a treadmill.

Honest counterweights:

- The compatibility guarantee is a **vendor promise**, documented but not
  something this report verified empirically.
- Tooling lags the platform: `@zeppos/device-types` is at 4.0 while shipping
  devices are at API_LEVEL 4.4 **[repo/npm]**.
- The genuine recurring cost is **new screen geometries**, not broken APIs.
  Every new resolution class is a new layout, permanently.

## 8.3 Maintenance budget

On the evidence above, a realistic steady state is **~4–8 h/year**: occasional
SDK/CLI bumps, a typings update, and layout work when a device introduces a
resolution you care about. That is not the picture of an ecosystem that will
force a rewrite every year — but it is not zero, and it is strictly more than
this repo costs today.

Worth stating plainly: **`fitbit-otp-auth-app` is cheap to maintain precisely
because Fitbit's platform is dead.** `@fitbit/sdk` has not moved since 2023
(§6.1), so nothing forces work. Zepp OS is alive, which is the point of porting
to it, and aliveness has a subscription fee paid in hours.

## 8.4 So is it worth it?

This depends on one thing the report cannot settle:

- **Personal use** — the treadmill mostly disappears. Pin an API level,
  sideload, ignore new devices, skip store review. The question becomes whether
  45–60 h is a fair price for a working authenticator on a watch you own.
- **Publishing for others** — the ecosystem returns little that is measurable.
  No paid listing is possible (§7.2), no public ratings or install counts exist
  (§7.4), and _polish is the least durable advantage you can build_: a rival can
  match it in a weekend. The advantages that don't rot are TOTP correctness
  under test, clock-drift compensation, and `otpauth-migration://` import
  (§7.3).

A third option deserves weighing: **contribute to `Lisoveliy/totpfit`** instead
of building a seventh app. It already has migration import and phone-side
editing. Blocker: it declares **no license** **[repo]**, so contributing GPL-3.0
code — or reusing its code here — is legally unclear until the author sets one.

**Decision: build.** Two reasons, and the first is the one that settles it.

The project's deliverable is a write-up of what porting an app with Claude is
actually like (§8.4's "personal use" branch, reframed). **Contributing does not
produce that.** Upstreaming a better TOTP core into someone else's Zepp app
exercises none of the interesting surface — no device UI against `@zos/ui`, no
Side Service, no BLE transport, no Settings App, no toolchain bring-up. It would
be a pull request, not a port, and there would be nothing to write about beyond
"I read someone's code and improved a function."

Second, the licensing blocker is real and unilateral. TOTPFit declares no
license, which by default means all rights reserved: its code cannot be reused
here, and a GPL-3.0 contribution into an unlicensed tree leaves both sides in an
unclear position. Resolving it depends on an author who develops primarily on
his own Gitea and mirrors to GitHub for issues **[repo]** — not a dependency
worth putting on the critical path.

The honest counterweight, which the write-up should state rather than bury: on
pure user value, contributing probably wins. TOTPFit already has
`otpauth-migration://` import and phone-side editing, and a seventh authenticator
in a field of six serves nobody who isn't already served. Building is the right
call **because the goal is the experience, not the market** — and that is worth
saying out loud instead of retrofitting a market rationale onto it.
