/* The bundled app.js otherwise contains no import or export statement, so
 * Zeus's CommonJS plugin wraps it, and the wrapper throws on the device:
 * "cannot set property 'exports' of undefined". This import keeps the bundle
 * recognizably ESM. ZML loads @zos/utils at runtime regardless. */
import "@zos/utils"
import { BaseApp } from "@zeppos/zml/base-app"

App(
  BaseApp({
    onCreate() {},

    onDestroy() {}
  })
)
