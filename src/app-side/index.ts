import { gettext } from "i18n"

AppSideService({
  onInit() {
    console.log(gettext("Retrieving tokens..."))
  },

  onRun() {},

  onDestroy() {}
})
