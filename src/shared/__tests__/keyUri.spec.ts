/* spell-checker:ignore HXDMVJECJJWSRB3HWIZR4IFUGFTMXBOZ MJUXILTMPEXTEWRWMNFEITY unstub */

import type { TotpConfig } from "../TotpConfig"
import { totpConfigFromUri } from "../keyUri"

describe("keyUri", () => {
  describe("totpConfigFromUri", () => {
    describe("throws for", () => {
      it("non-URL", () => {
        expect(() => totpConfigFromUri("this is not a URL")).toThrow()
      })

      it("all protocols except otpauth", () => {
        expect(() => totpConfigFromUri("https://www.example.com")).toThrow()
      })

      it("other protocols even with a label path", () => {
        expect(() => totpConfigFromUri("https://example.com/label")).toThrow(
          /protocol mismatch/
        )
      })
    })

    /* The Settings App runtime rejected every pasted URI on hardware; the
     * browser URL API is the suspected cause, so parsing must not need it. */
    describe("without the URL API", () => {
      beforeEach(() => {
        vi.stubGlobal("URL", undefined)
        vi.stubGlobal("URLSearchParams", undefined)
      })
      afterEach(() => {
        vi.unstubAllGlobals()
      })

      it("tolerates surrounding whitespace, empty and valueless pairs", () => {
        expect(
          totpConfigFromUri(
            `  otpauth://totp/a?&flag&secret=${"HXDMVJECJJWSRB3HWIZR4IFUGFTMXBOZ"}&secret=X \n`
          )
        ).toMatchObject({ secret: "HXDMVJECJJWSRB3HWIZR4IFUGFTMXBOZ" })
      })

      it("still parses a key URI", () => {
        expect(totpConfigFromUri(getUrl({ label: "a b" }))).toMatchObject({
          label: "a b",
          secret: "HXDMVJECJJWSRB3HWIZR4IFUGFTMXBOZ"
        })
      })
    })

    describe("extracts", () => {
      describe("the label", () => {
        it("by decoding it", () => {
          const SOME_LABEL_WITH_CHARS_REQUIRING_ENCODING = "a b/c#dä é"

          expect(
            totpConfigFromUri(
              getUrl({ label: SOME_LABEL_WITH_CHARS_REQUIRING_ENCODING })
            )
          ).toMatchObject({
            label: SOME_LABEL_WITH_CHARS_REQUIRING_ENCODING
          })
        })

        it("by ignoring an optional issuer prefix for the label", () => {
          const SOME_LABEL = "some_label"

          expect(
            totpConfigFromUri(
              getUrl({ label: SOME_LABEL, issuerInLabel: "some_issuer" })
            )
          ).toMatchObject({
            label: SOME_LABEL
          })
        })
      })

      describe("the issuer", () => {
        it("from the URL parameter", () => {
          const SOME_ISSUER = "someIssuer"

          expect(
            totpConfigFromUri(getUrl({ issuer: SOME_ISSUER }))
          ).toMatchObject({
            issuer: SOME_ISSUER
          })
        })

        it("from the label if the URL parameter is not set", () => {
          const SOME_ISSUER = "someIssuer"

          expect(
            totpConfigFromUri(getUrl({ issuerInLabel: SOME_ISSUER }))
          ).toMatchObject({
            issuer: SOME_ISSUER
          })
        })

        it("by prioritizing the URL parameter if issuer also present in label", () => {
          const SOME_ISSUER_IN_URL_PARAM = "someIssuerInUrlParam"

          expect(
            totpConfigFromUri(
              getUrl({
                issuer: SOME_ISSUER_IN_URL_PARAM,
                issuerInLabel: "some_issuer"
              })
            )
          ).toMatchObject({
            issuer: SOME_ISSUER_IN_URL_PARAM
          })
        })
      })

      it("secret", () => {
        const SOME_SECRET = "MJUXILTMPEXTEWRWMNFEITY"

        expect(
          totpConfigFromUri(getUrl({ period: SOME_SECRET }))
        ).toMatchObject({
          period: SOME_SECRET
        })
      })

      it.each(["SHA1", "SHA256", "SHA512"])("algorithm %s", algorithm => {
        expect(totpConfigFromUri(getUrl({ algorithm }))).toMatchObject({
          algorithm
        })
      })

      it.each(["6", "8"])("digits %s", digits => {
        expect(totpConfigFromUri(getUrl({ digits }))).toMatchObject({
          digits
        })
      })

      it("period", () => {
        const SOME_PERIOD = "42"

        expect(
          totpConfigFromUri(getUrl({ period: SOME_PERIOD }))
        ).toMatchObject({
          period: SOME_PERIOD
        })
      })
    })

    describe("uses correct default value for", () => {
      // spellchecker: disable
      const SOME_URI_WITHOUT_DEFAULTS =
        "otpauth://totp/ACME%20Co:john.doe@email.com?secret=HXDMVJECJJWSRB3HWIZR4IFUGFTMXBOZ&issuer=ACME%20Co"
      // spellchecker: enable

      it("algorithm", () => {
        expect(totpConfigFromUri(SOME_URI_WITHOUT_DEFAULTS)).toMatchObject({
          algorithm: "SHA1"
        })
      })
      it("digits", () => {
        expect(totpConfigFromUri(SOME_URI_WITHOUT_DEFAULTS)).toMatchObject({
          digits: "6"
        })
      })
      it("period", () => {
        expect(totpConfigFromUri(SOME_URI_WITHOUT_DEFAULTS)).toMatchObject({
          period: "30"
        })
      })
    })

    function getUrl(
      config: Partial<Record<keyof TotpConfig, string>> & {
        rawLabel?: string
        issuerInLabel?: string
        protocol?: string
        tokenType?: string
        secret?: string
      }
    ) {
      return `${config.protocol ?? "otpauth:"}//${
        config.tokenType ?? "totp"
      }/${getLabel(
        config.rawLabel,
        config.issuerInLabel,
        config.label
        // spell-checker: disable
      )}?secret=${config.secret ?? "HXDMVJECJJWSRB3HWIZR4IFUGFTMXBOZ"}&issuer=${
        // spell-checker: enable
        config.issuer ?? ""
      }&algorithm=${config.algorithm ?? "SHA1"}&digits=${
        config.digits ?? "6"
      }&period=${config.period ?? "30"}`

      function getLabel(
        rawLabel?: string,
        issuerInLabel?: string,
        label?: string
      ) {
        const unencodedLabel = `${issuerInLabel ? issuerInLabel + ":" : ""}${
          label ?? "john.doe@email.com"
        }`

        return rawLabel || encodeURIComponent(unencodedLabel)
      }
    }
  })
})
