/* spell-checker:ignore HXDMVJECJJWSRB3HWIZR4IFUGFTMXBOZ */

import { BaseSideService } from "@zeppos/zml/base-side"
import { GET_TOKENS_METHOD } from "../shared/PeerMessage"
import type { TotpConfig } from "../shared/TotpConfig"

/** Hard-coded until the Settings App writes real Tokens (Phase 2). */
const SPIKE_TOKEN: TotpConfig = {
  label: "john.doe@email.com",
  issuer: "binary poetry",
  secret: "HXDMVJECJJWSRB3HWIZR4IFUGFTMXBOZ",
  algorithm: "SHA1",
  digits: "6",
  period: "30"
}

AppSideService(
  BaseSideService({
    /* Logged to learn whether a device `request` launches the Side Service
     * when it is not already running (ADR-0002 amendment). */
    onInit() {
      console.log(
        `side onInit launchReasons=${JSON.stringify(sideService.launchReasons)} launchArgs=${JSON.stringify(sideService.launchArgs)}`
      )
    },

    onRequest(
      request: { method: string },
      respond: (error: unknown, data: unknown) => void
    ) {
      console.log(`side onRequest method=${request.method}`)
      if (request.method === GET_TOKENS_METHOD) {
        respond(null, [SPIKE_TOKEN])
      } else {
        respond(new Error(`Unknown method "${request.method}"`), null)
      }
    },

    onDestroy() {
      console.log("side onDestroy")
    }
  })
)
