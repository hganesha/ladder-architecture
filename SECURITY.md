# Security Policy

## Reporting

Please report vulnerabilities privately through the repository’s security advisory feature. Do not include secrets or exploitable payloads in a public issue.

## Threat model

Ladder Graph is a local visual compiler. It does not execute workflows, imported content, tools, shell commands, model calls, or MCP operations. It does parse untrusted YAML and generate downloadable Markdown, so parser denial-of-service, content injection, browser storage exposure, and supply-chain changes are in scope.

Controls include a 2 MB import cap, 1,000-node cap, custom-tag and alias rejection, duplicate-key parsing, a safe transform allowlist, external-reference rejection, text-only previews, self-hosted assets, strict security headers, and no runtime network dependency.

Generated files describe requested capabilities but do not grant them. Users must review workflows before pasting or installing them as skills.

## Supported versions

Security fixes are provided for the latest released minor version on the default branch.
