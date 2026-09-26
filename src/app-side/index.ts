import { BaseSideService, settingsLib } from "@zeppos/zml/base-side"
import { GET_TOKENS_METHOD, PEER_MESSAGE_METHOD } from "../shared/PeerMessage"
import { messageForSettingsChange, tokensMessage } from "./sync"

/**
 * Side Service — the ZML transport adapter. Everything that decides what to
 * send lives in `./sync`; this file only maps it onto `onRequest` (the
 * watch's launch pull) and `call` (the push on a Token change), per the
 * ADR-0002 amendment.
 *
 * `console.log` here does not reach `zeus bridge`; see TODO.md.
 */
AppSideService(
  BaseSideService({
    onRequest(
      request: { method: string },
      respond: (error: unknown, data: unknown) => void
    ) {
      if (request.method === GET_TOKENS_METHOD) {
        respond(null, tokensMessage(settingsLib))
      } else {
        respond(new Error(`Unknown method "${request.method}"`), null)
      }
    },

    onSettingsChange({ key }: { key: string }) {
      const message = messageForSettingsChange(key, settingsLib)
      if (message !== undefined) {
        this.call({ method: PEER_MESSAGE_METHOD, params: message })
      }
    }
  })
)
