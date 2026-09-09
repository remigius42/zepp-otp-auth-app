/*
 * Note the asymmetry with the `lint` script: that one runs `tsc --noEmit` over
 * the whole program, which cannot be narrowed to staged files. Type errors are
 * therefore caught in CI and by the editor, not by this hook.
 */
const LINT_STAGED_CONFIG = {
  "**/*": [
    "prettier --no-error-on-unmatched-pattern --ignore-unknown --list-different",
    "cspell --dot --no-must-find-files --no-progress"
  ],
  "**/*.md": "markdownlint-cli2",
  "**/*.{ts,mts,mjs,js}": [
    "oxlint --max-warnings=0",
    () => "vitest run --passWithNoTests"
  ]
}

export default LINT_STAGED_CONFIG
