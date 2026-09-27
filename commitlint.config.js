module.exports = {
  extends: ["@commitlint/config-conventional"],
  // Dependabot's bodies carry release notes with lines past the 100-char limit
  ignores: [message => message.includes("dependabot[bot]")],
  rules: {
    // Disable footer line length to allow long URLs
    "footer-max-line-length": [0, "always"]
  }
}
