/**
 * `promise`, or a rejection once `ms` have passed without it settling. ZML's
 * own `timeout` option did not fire for a pull sent right after Bluetooth
 * returned; the watch waited for good.
 */
export function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`timed out after ${ms} ms`))
    }, ms)
    promise.then(
      value => {
        clearTimeout(timer)
        resolve(value)
      },
      (error: unknown) => {
        clearTimeout(timer)
        reject(error)
      }
    )
  })
}
