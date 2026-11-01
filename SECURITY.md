# Security notes

This project adds same-origin JavaScript to a separate Jellyfin Web entry page. Installed browser code has the authority of that Jellyfin document and must be trusted accordingly. It uses existing Jellyfin controls and router/command handlers; it does not implement an authentication service or grant server permissions. The opt-in URL selects UI behavior and is not an access-control boundary.

## Source review before initial publication

The initial four browser adapters, four shell scripts and two development readmes received a static source review before repository preparation. The review followed DOM input to rendering/navigation/native actions and local installation inputs to privileged filesystem writes, including update and recovery paths. Independent reviewers examined coverage and the sole retained disclosure hypothesis.

No authentication bypass, unauthorized root-write route, hardcoded password, API key, private key or direct network-exfiltration path was established in that source. The adapters do not directly access cookies, credential storage or token APIs, or issue fetch/XHR/WebSocket requests. Dynamic diagnostic output uses textContent rather than HTML parsing. These are source observations, not a guarantee that vulnerabilities cannot exist.

The review identified a **needs-validation privacy lead** in the development revision: optional diagnostics displayed raw keydown values. If a masked password input delivered printable key events, a screen observer could read successive characters. Actual Jellyfin/Conjure password-event delivery was not observed, so this was not classified as a confirmed vulnerability and no severity was assigned. Quick Connect avoids typing a password.

## Changes made before publication

- Back helper revision 4 reports only fixed navigation key names and fixed placeholders for other or editable input. It never includes a raw printable key or numeric key code in its diagnostic message. Focus and blur reset stale diagnostic text.
- Installers use a fixed utility PATH, restrictive umask, and the installer's own directory. Before writing, they require root-owned source, webroot and backup ancestry without group/world write; reject symlinks, nonregular files and hard-linked file inputs/targets. This reduces accidental installation from a shared staging location. It does not defend against an already privileged root administrator or authenticate the GitHub checkout.
- A dedicated release allowlist excludes development archives, console output, local audit prompts/reports, host configuration, private deployment addresses and credentials. Public examples use a placeholder host. No dependencies or workflow credentials are included.
- The normal Jellyfin index is preserved; trial removal and update backups provide recovery. Multi-file updates still use sequential renames and can leave mixed versions after interruption.

## Limits and pending validation

The audit was **source-only**. No live server, real user session, TV pairing endpoint or production credential was tested. The Windows review environment did not provide the complete no-network, empty-environment, read-only-source/toolchain, scratch-only, resource-limited OS sandbox required for target-code execution. Browser fixtures and Linux installer integration tests were not run during this review.

The audit's unmodified exported JSON validator APIs passed structural/semantic checks on parent-authored review records. Its protected CLI reader could not run on Windows because required no-follow/nonblocking input flags were unavailable. The formal local audit run therefore records an incomplete status for that platform limitation, rather than claiming full tool completion.

The release changes received an additional static review. Runtime verification of the diagnostic fix, privileged installer failure cases, actual TV navigation and Jellyfin integration remains pending. Earlier development included simulated DOM checks; they do not establish security or compatibility of this published revision. **Only the VIZIO V4K65X-0810 has been tested during project development.** No other model is claimed as supported.

Upstream Jellyfin authentication and authorization, third-party Conjure behavior, TV firmware/browser security, filesystem ACLs, server headers, TLS and network exposure are outside this repository's source review. HTTP on a LAN is not encrypted; use a trusted network and an HTTPS configuration the TV can validate where available. Do not bypass certificate warnings or disable authentication to use this proof of concept.

## Reporting an issue

Do not include tokens, passwords, Quick Connect codes, TV pairing values, unredacted logs, private server URLs or account data in public reports. For an ordinary navigation bug, describe the page, key press, expected action, Jellyfin version and TV model. For a potential security issue, avoid posting an exploit or secret publicly; use a private reporting channel offered by the repository owner if available.
