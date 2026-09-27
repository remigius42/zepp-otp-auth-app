<!-- cspell:disable -->

# OTP Auth Anleitung

[English](./README.md)

OTP Auth zeigt die zeitbasierten Einmalpasswörter (TOTP) Ihrer Konten auf Ihrer
Amazfit-Uhr. Das **Token** jedes Kontos fügen Sie in der Zepp-App auf Ihrem
Telefon hinzu; die Uhr zeigt dann seinen aktuellen sechs- oder achtstelligen
**Code**.

## Schnellstart

1. Installieren Sie OTP Auth auf Ihrer Uhr.
2. Öffnen Sie OTP Auth auf der Uhr. Sie zeigt «Fügen Sie Tokens in der Zepp-App
   hinzu.»
3. Öffnen Sie auf dem Telefon die Zepp-App und dort die Einstellungen von OTP
   Auth.
4. Fügen Sie ein Token hinzu, entweder durch Einfügen einer `otpauth://`-URI
   oder durch manuelle Eingabe (siehe unten).
5. Die Uhr zeigt den Code des Tokens. Der Ring daneben zeigt, wie lange der Code
   noch gültig ist.

## Tokens hinzufügen

Wenn Sie die Zwei-Faktor-Authentisierung einschalten, zeigt ein Dienst einen
QR-Code für Authenticator-Apps und meist daneben einen Textschlüssel («Scannen
nicht möglich? Geben Sie diesen Schlüssel ein»). Beides funktioniert.

### Token manuell hinzufügen

Der privateste Weg: Den Schlüssel sehen nur Sie und die Zepp-App.

- **Bezeichnung**: meist Ihr Kontoname oder Ihre E-Mail-Adresse.
- **Aussteller**: der Dienst, z. B. «GitHub».
- **Schlüssel in Base32**: der Textschlüssel des Dienstes. Lassen Sie
  Leerzeichen weg; Gross- oder Kleinschreibung spielt keine Rolle.
- **Algorithmus**, **Anzahl Ziffern**, **Gültigkeitsdauer in Sekunden**: SHA1, 6
  und 30 belassen, ausser der Dienst gibt etwas anderes an.

Tippen Sie auf **Token hinzufügen**. Bei Erfolg leeren sich die Felder, sodass
der Schlüssel vom Bildschirm verschwindet. **Zurücksetzen auf Standardwerte**
leert sie, ohne etwas hinzuzufügen.

Ein Tippfehler im Schlüssel ist nicht erkennbar: Ein Schlüssel mit einem
fehlenden oder vertauschten Zeichen ist immer noch ein gültiger Schlüssel, nur
ein anderer. OTP Auth nimmt ihn an und zeigt Codes, die der Dienst ablehnt.
Abgewiesen werden nur Zeichen ausserhalb von `A`–`Z` und `2`–`7`. Prüfen Sie
den ersten Code beim Dienst, bevor Sie sich auf das Token verlassen.

### Eine `otpauth://`-URI einfügen

Der QR-Code enthält eine URI, die mit `otpauth://` beginnt. Scannen Sie ihn mit
einem QR-Leser, der den Text anzeigt, kopieren Sie ihn und fügen Sie ihn in
**otpauth://-URI einfügen** ein. Das Feld leert sich, sobald das Token
hinzugefügt ist.

- **Android**: Die meisten Kamera-Apps und QR-Leser zeigen den Text. Ist eine
  Authenticator-App installiert, öffnet die Kamera womöglich stattdessen diese.
- **iOS**: Die Kamera-App meldet bei diesen Codes oft «Keine verwendbaren Daten
  gefunden». Verwenden Sie Live Text auf einem Foto des QR-Codes oder einen
  QR-Leser, der den Rohtext zeigt. Löschen Sie das Foto danach: Es enthält den
  Schlüssel, und Ihre Fotomediathek wird womöglich in die Cloud gesichert.
- **Bevorzugen Sie Leser, die auf dem Telefon arbeiten.** Google Lens lädt das
  Bild zu Google hoch und damit den Schlüssel. Die Kamera-Apps der Hersteller
  dekodieren auf dem Telefon.
- Manche Apps kopieren die URI prozentkodiert, beginnend mit `otpauth%3A`. OTP
  Auth meldet das; kopieren Sie sie aus einem anderen Leser oder fügen Sie das
  Token manuell hinzu.
- Die URI bleibt nach dem Einfügen in der Zwischenablage. Kopieren Sie danach
  etwas anderes.

### Nicht unterstützt

- **Tokens aus einem QR-Bild oder einer Exportdatei hinzufügen.** Bewusst
  weggelassen: Beides lässt Ihre Schlüssel unverschlüsselt auf dem Telefon
  liegen, wo Backups und andere Apps sie erreichen.

## Tokens verwalten

Der Abschnitt **Tokens** listet alle Tokens in der Reihenfolge, in der die Uhr
sie zeigt.

- **Umbenennen**: Tippen Sie auf ein Token und geben Sie einen eigenen Namen
  ein. Leeren Sie den Namen, um zu «Aussteller (Bezeichnung)» zurückzukehren.
- **Reihenfolge**: ↑ und ↓ verschieben ein Token um einen Platz.
- **Löschen**: ✕, dann mit **Löschen** bestätigen. Das Token verschwindet auch
  von der Uhr. Stellen Sie vor dem Löschen sicher, dass Sie sich auch ohne es
  beim Dienst anmelden können.

Ist OTP Auth auf der Uhr geöffnet, kommen Änderungen sofort an, sonst beim
nächsten Öffnen.

## Auf der Uhr

OTP Auth lässt den Bildschirm eine Minute lang an, damit Sie Zeit haben, einen
Code einzutippen.

Die Uhr speichert Ihre Tokens nicht. Bei jedem Öffnen von OTP Auth holt sie sie
vom Telefon; dazu braucht das Telefon eingeschaltetes Bluetooth und eine
laufende Zepp-App.

- **«Warte auf das Telefon...»**: Die Tokens werden geholt, meist etwa eine
  Sekunde lang.
- **«Telefon nicht erreichbar. …»**: Prüfen Sie Bluetooth und die Zepp-App und
  tippen Sie dann auf die Meldung, um es erneut zu versuchen.
- **«Fügen Sie Tokens in der Zepp-App hinzu.»**: noch keine Tokens.

Tippen Sie auf ein Token, um es allein und mit grösserem Code anzuzeigen. Mit
der Zurück-Wischgeste kehren Sie zur Liste zurück.

Jeder Code wird auf der Uhr berechnet, was für SHA1- und SHA256-Tokens wenige
Hundertstelsekunden dauert. **Die SHA-512-Unterstützung ist eher ein
Machbarkeitsnachweis:** Die Uhr braucht fast eine halbe Sekunde pro
SHA512-Code. Jedes SHA512-Token verzögert das Öffnen von OTP Auth um etwa eine
Sekunde, und die Liste stockt kurz, wenn sein Code wechselt.

## Einstellungen

- **Vergrösserte Tokenansicht**: grössere Namen und Codes, weniger Tokens pro
  Bildschirm.
- **Uhrenfehler kompensieren**: Ein Code gilt nur 30 Sekunden, also gibt eine
  Uhr, die ein paar Sekunden falsch geht, falsche Codes. Ist dies eingeschaltet,
  sendet das Telefon mit den Tokens seine Uhrzeit, und die Uhr gleicht die
  Differenz aus. Ändert sich die Korrektur merklich, zeigt die Uhr
  «Uhrenabgleich...». Standardmässig eingeschaltet.
- **Farbschema**: Bernstein auf Schwarz, Weiss auf Schwarz oder Schwarz auf
  Weiss.

## Diagnose

Die **Sync-Statistik** zeigt, wie oft die Uhr ihre Tokens geholt hat, wie oft
das fehlschlug und wie lange es dauerte. Das hilft beim Melden von Problemen.
**Sync-Statistik zurücksetzen** beginnt die Zählung von vorn, etwa nach einem
Test.

## Sicherheitshinweise

- Ihre Schlüssel liegen in den Einstellungen von OTP Auth in der Zepp-App auf
  Ihrem Telefon und werden per Bluetooth zur Uhr gesendet. Die Uhr hält sie nur
  im Arbeitsspeicher, solange OTP Auth geöffnet ist.
- OTP Auth sichert Ihre Tokens nicht. Bewahren Sie die Wiederherstellungscodes
  auf, die Ihnen jeder Dienst beim Einschalten der Zwei-Faktor-Authentisierung
  gibt.

<!-- cspell:enable -->
