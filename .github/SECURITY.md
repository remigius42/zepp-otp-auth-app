# Security Policy

OTP Auth handles TOTP Secrets, so a flaw can hand someone your second factor.
The threat model and what the app deliberately does not protect against are in
[ADR-0004](../docs/adr/0004-no-on-watch-token-storage-initially.md) and the
manual's
[security notes](../docs/manual/README.md#security-notes).

## Supported Versions

Nothing is released yet; fixes go to `main`. Once there are releases, only the
latest one is supported.

## Reporting a Vulnerability

Please **do not** open a public GitHub issue for security vulnerabilities.

Instead, use GitHub's private vulnerability reporting by clicking the
**"Report a vulnerability"** button on the
[Security Advisories](../../security/advisories) page (or when creating a new
issue). Reports are only visible to maintainers until disclosed.

Never include a real Secret, `otpauth://` URI or `zeus bridge` log from your
own accounts in a report; the bridge log contains every synced Secret. Use a
test Token instead.

Response times are best-effort for this personal project.
