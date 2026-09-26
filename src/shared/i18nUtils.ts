import { gettext } from "i18n"

/** Translate `msgid`, then substitute every `reference` in the result. */
export function gettextWithReplacement(
  msgid: string,
  reference: string,
  replacement: string
) {
  return gettext(msgid).replace(new RegExp(reference, "g"), replacement)
}
