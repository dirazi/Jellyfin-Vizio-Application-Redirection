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

## Small follow-up review: app shortcut redirect

On 2026-11-01, a focused static review revisited all twelve existing repository files and the new configurable redirect monitor, sample config, service and documentation. It looked for embedded credentials/private deployment data, network exfiltration, dynamic code execution, credential reads, privileged file writes, and interference with preserved app paths. No malicious behavior, embedded password/API key/private key, or direct network-exfiltration path was identified in the reviewed release. This is a bounded source observation, not a guarantee of safety or a full penetration test.

The new monitor intentionally holds a TV control bearer token locally. It keeps that file outside the checkout/webroot, root-owned and private, writes replacement tokens atomically, checks token file type/ownership/link count/permissions, and never logs the token. It creates no inbound HTTP service, downloads no packages, invokes no shell, and disables environment proxies and TV API redirects. Its certificate exception is confined to the local SmartCast client, but it does not protect against an active network attacker impersonating the TV. The configured TV, hosted app and administrator-owned configuration remain trusted inputs.

Redirecting uses exact APP_ID/NAME_SPACE/MESSAGE transitions, a startup/recovery baseline, cooldown, launch-rate limit and process lock. It cannot identify a physical button when multiple entry paths share an app state. Preserved WatchFree+ paths must be tested on the owner's TV before enabling a redirect. Generalized source changes were reviewed but not freshly run on a TV or tested as a Linux service in the publication environment. The owner confirmed the earlier deployment-specific redirect worked; that does not validate every generalized configuration or the complete browser-adapter release.

The release contains placeholder hosts only. Capture mode intentionally prints local app metadata and may reveal private URLs from other apps; redact it before sharing. Ignore rules reduce accidental inclusion but do not sanitize Git history or replace review. Existing Git commit attribution is public GitHub metadata; this update does not rewrite historical author records.

Navigation revision 10 extends local DOM navigation to menus, listboxes and checkbox labels, and adjusts scroll margins and toolbar candidate selection. It adds no network calls, credential access, HTML parsing or dependency downloads. Labels and app controls continue to come from the existing Jellyfin document. Disabled and hidden controls remain excluded, and the opt-in path/query guard remains required. Its regression checks use synthetic elements and dummy states only; they provide no browser security or physical-TV guarantee.

## Small follow-up review: navigation revision 11

On 2026-11-03, a focused static review examined the revision-11 navigation diff, its regression fixtures and the installer cache-reference changes. No new authentication bypass, credential disclosure, script-injection path, external request or privileged-write path was identified in that diff. This is a limited source review, not a guarantee that the project is free of vulnerabilities.

The change reads existing DOM geometry and alphabet labels to choose focus targets; it adds no network calls, storage, dynamic code evaluation, dependencies or HTML parsing. It preserves the opt-in path/query guard, disabled/hidden-control filtering and open-menu/listbox scope. Enter/OK activation is unchanged. The shell changes only refresh the navigation script version; existing ownership checks, backups and normal-index preservation remain in place.

Earlier development checks passed with synthetic DOM fixtures, including offscreen rows, Settings dropdowns and alphabet/header boundaries. They were not rerun during this source-only review: the review environment lacks the complete execution sandbox required by the security-review procedure. The owner confirmed installation of revision 11; physical-TV regression results are still pending. Server authentication, proxy/firewall rules and TV firmware are outside this small review.

## Reporting an issue

Do not include tokens, passwords, Quick Connect codes, TV pairing values, unredacted logs, private server URLs or account data in public reports. For an ordinary navigation bug, describe the page, key press, expected action, Jellyfin version and TV model. For a potential security issue, avoid posting an exploit or secret publicly; use a private reporting channel offered by the repository owner if available.
