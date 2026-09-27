# OTP Auth manual

[Deutsch](./de.md)

OTP Auth shows the time-based one-time passwords (TOTP) of your accounts on
your Amazfit watch. You add each account's **Token** in the Zepp app on your
phone; the watch then shows its current six- or eight-digit **Code**.

## Quick start

1. Install OTP Auth on your watch.
2. Open OTP Auth on the watch. It shows "Add Tokens in the Zepp app."
3. On your phone, open the Zepp app and go to OTP Auth's settings.
4. Add a Token, either by pasting an `otpauth://` URI or by entering it
   manually (see below).
5. The watch shows the Token's Code. The ring next to it shows how much of the
   Code's validity is left.

## Adding Tokens

When you turn on two-factor authentication, a service shows a QR code for
authenticator apps, and usually a text key next to it ("Can't scan? Enter this
key instead"). Either works.

### Add token manually

The most private way, since nothing but you and the Zepp app sees the key.

- **Label**: usually your account name or email address.
- **Issuer**: the service, e.g. "GitHub".
- **Secret in Base32**: the text key the service shows. Leave out any spaces
  it is shown with; upper or lower case both work.
- **Algorithm**, **Number of digits**, **Period in seconds**: leave SHA1, 6 and
  30 unless the service says otherwise.

Tap **Add token**. On success the fields empty, so the Secret leaves the
screen. **Reset to defaults** empties them without adding anything.

### Paste an `otpauth://` URI

The QR code contains a URI starting with `otpauth://`. Scan it with a QR reader
that shows the text, copy it, and paste it into **Paste otpauth:// URI**. The
field empties once the Token is added.

- **Android**: most camera apps and QR readers show the text. If an
  authenticator app is installed, the camera may open that app instead.
- **iOS**: the Camera app often reports "No usable data found" for these codes.
  Use Live Text on a photo of the QR code, or a QR reader that shows raw text.
  Delete the photo afterwards: it holds the Secret, and your photo library may
  be backed up to the cloud.
- **Prefer readers that work on your phone.** Google Lens uploads the image to
  Google, and with it the Secret. Stock camera apps decode on the phone.
- Some apps copy the URI percent-escaped, starting with `otpauth%3A`. OTP Auth
  says so; copy it from another reader or add the Token manually.
- The URI stays on your clipboard after you paste it. Copy something else
  afterwards.

### Not supported

- **Adding Tokens from a QR image or an export file.** Left out on purpose:
  both keep your Secrets unencrypted on the phone, where backups and other apps
  can reach them.

## Managing Tokens

The **Tokens** section lists every Token in the order the watch shows them.

- **Rename**: tap a Token and type a name of your own. Empty the name to return
  to "Issuer (Label)".
- **Reorder**: ↑ and ↓ move a Token one place.
- **Delete**: ✕, then confirm with **Delete**. The Token is gone from the watch
  too. Before deleting, make sure you can still sign in to the service without
  it.

Changes reach the watch at once while OTP Auth is open on it, and otherwise the
next time you open it.

## On the watch

OTP Auth keeps the screen on for a minute, so you have time to type a Code.

The watch does not store your Tokens. Each time you open OTP Auth, it fetches
them from your phone, so the phone needs Bluetooth on and the Zepp app running.

- **"Waiting for your phone..."**: fetching the Tokens, usually about a second.
- **"Phone not reachable. …"**: check Bluetooth and the Zepp app, then tap the
  message to try again.
- **"Add Tokens in the Zepp app."**: no Tokens yet.

Tap a Token to show it alone, with a larger Code. Swipe back to return to the
list.

Each Code is computed on the watch. With many Tokens, more than about eight,
the list may respond sluggishly.

## Settings

- **Enlarge token information**: larger names and Codes, fewer Tokens per
  screen.
- **Compensate clock drift**: a Code is valid for only 30 seconds, so a watch
  clock that is a few seconds off gives wrong Codes. With this on, the phone
  sends its time along with the Tokens and the watch corrects for the
  difference. When the correction changes noticeably, the watch shows
  "Synchronizing clock...". On by default.
- **Color scheme**: amber on black, white on black, or black on white.

## Diagnostics

**Sync Stats** show how often the watch fetched its Tokens, how often that
failed, and how long it took. They help with reporting problems. **Reset Sync
Stats** starts counting afresh, for example after testing.

## Security notes

- Your Secrets are stored in the Zepp app's settings for OTP Auth on your phone,
  and sent to the watch over Bluetooth. The watch keeps them in memory only
  while OTP Auth is open.
- OTP Auth does not back up your Tokens. Keep the recovery codes each service
  gives you when you turn on two-factor authentication.
