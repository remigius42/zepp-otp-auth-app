import { gettext } from "i18n"

AppSettingsPage({
  build() {
    return Section({ title: gettext("Tokens") }, [
      Text({ paragraph: true }, gettext("Tokens section description"))
    ])
  }
})
