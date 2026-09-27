# Architecture decision records

Decisions worth not re-litigating, each with its context and the alternatives
it rejected. Later findings are added as dated amendments rather than by
rewriting the original decision.

- **0001** [Enrollment: local file import, never a hosted scanner](./0001-local-file-enrollment-no-hosted-scanner.md)
  - Amended 2026-09-27: no file import after all
- **0002** [`@zeppos/zml` as the Sync transport, and one message per Sync](./0002-zml-transport-and-single-token-message.md)
  - Amended 2026-09-26: the watch pulls on launch
  - Amended 2026-09-26: what the one message carries
- **0003** [No connection status indicator on the phone](./0003-no-phone-side-connection-status.md)
  - Amended 2026-09-26: failures surface on the watch
- **0004** [Ship without on-watch Token storage; revisit only if the connection proves bad](./0004-no-on-watch-token-storage-initially.md)
  - Amended 2026-09-26: app settings are not persisted on the watch either
  - Amended 2026-09-26: the revisit trigger, made measurable
  - Amended 2026-09-27: the watch remembers the color scheme
- **0005** [The per-row progress arc becomes pre-rendered image frames](./0005-progress-arc-as-prerendered-image-frames.md)
  - Amended 2026-09-26: how the frames are made
  - Amended 2026-09-27: 60 frames, not 30
  - Amended 2026-09-27: the fallback stays unused
- **0006** [TypeScript sources, compiled to JavaScript before Zeus sees them](./0006-typescript-via-precompile-step.md)
  - Amended 2026-09-26: the step also bundles dependencies
- **0007** [The watch has no BigInt, so SHA-512 is unsupported until vendored](./0007-no-bigint-on-the-watch.md)
  - Amended 2026-09-27: SHA-512 is back, and every hash is our own
