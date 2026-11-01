# Redirect a Vizio shortcut to your own webfront

This optional Linux monitor watches an already paired TV through the local SmartCast API. When the current app **changes into one exact configured state**, it asks Conjure to open a hosted webpage. The original remote still sends its original command; the monitor reacts after the TV opens that entry point. A brief glimpse of the original app is possible. This does not change firmware, install a native app, add a Home tile, intercept IR, or change DNS.

The destination can be your own Jellyfin frontend, another compatible media web app, or a dashboard you host and trust. Change the destination URL in local configuration. The four existing JavaScript adapters are specifically for Jellyfin Web; do not inject them into unrelated apps. Your chosen app must itself work in the TV browser, accept the remote's keys or supply its own navigation, and support the TV's playback capabilities. An arbitrary Android/native TV app cannot be installed this way.

## Why Crackle was chosen

The tested VIZIO V4K65X-0810 was controlled by a replacement remote with an obsolete Crackle button. The button worked, but launched a reassigned WatchFree+ On Demand entry point. The owner wanted to keep ordinary WatchFree+ available. Read-only captures showed distinct app triples:

| Entry method | APP_ID | NAME_SPACE | MESSAGE |
| --- | --- | --- | --- |
| Physical Crackle button | `"145"` | `4` | `https://ui.sctv.prod.smartcasttv.com/watchfreeplus/avod/entry/entrypoint.html` |
| Normal WatchFree+ Home tile | `"3014"` | `4` | `{"app":"watchfree","bundle":"bundles/watchfree-plus-loki-bundle","bundle-parameters":{"cname":"watchfree"}}` |

The deployment matched **all three values exactly**, rather than redirecting WatchFree+ generally. The owner reported that the tested launch/redirect behavior worked as intended. Only this TV model and these observed entry paths are confirmed; the generalized release/configuration and systemd unit need validation on each installation.

App state identifies an entry point, not the physical button. Any other route that reaches the same triple is indistinguishable. Test normal WatchFree+ navigation and On Demand paths in observation mode. If a route you want to preserve matches the trigger, do not enable this redirect. Polling can miss very short states, and firmware changes may change the identifiers.

## Requirements and local configuration

Use Linux with Python 3.9+ and the standard library, on an always-running machine/container that can reach your TV. The TV must reach the webfront itself. No inbound listener is created by this monitor. Use your own authorized TV and a trusted network; never forward the SmartCast control port to the Internet.

From a reviewed checkout, run the following as root **on the monitor host**. These are separate from the Jellyfin adapter installation. Review existing destinations before replacing files during an update.

```sh
install -d -m 0755 /usr/local/libexec
install -m 0755 ./vizio-app-redirect.py /usr/local/libexec/vizio-app-redirect.py
install -m 0600 ./redirect.example.json /etc/vizio-app-redirect.json
editor /etc/vizio-app-redirect.json
python3 -m py_compile /usr/local/libexec/vizio-app-redirect.py
```

Replace `TV_IP_ADDRESS` with the literal TV IP on your network. The default API port is 7345; older devices may use 9000. Replace `WEBFRONT_HOST` and the entire destination URL with your own reachable webpage. For this project's Jellyfin adapter use `/web/vizio.html?vizioNav=1`. For another webfront use its actual entry path. Keep the config root-owned and mode 600, outside the repository and served webroot.

The launch object represents the body inside `VALUE` in `PUT /app/launch`. The documented Conjure configuration used here is app `"17"`, namespace `4`, with the URL in `MESSAGE`. Verify with `launch-once`; a SUCCESS response alone does not prove the intended page appeared. Do not substitute old catalog IDs or copy another TV's state without testing.

Sources: [SmartCast API request schema and pairing](https://github.com/exiva/Vizio_SmartCast_API), [Vizio Conjure launcher](https://vizio-pm.s3-us-west-1.amazonaws.com/conjure-launcher.html), [Conjure client documentation](https://github.com/get-air/vizio#smart-app-cast--conjure).

## Pair and verify the destination

```sh
python3 /usr/local/libexec/vizio-app-redirect.py pair
python3 /usr/local/libexec/vizio-app-redirect.py launch-once
```

Enter the **new PIN currently displayed by your TV** when prompted. `pair` is a script argument; typing bare `pair` into a shell is not the pairing command. The resulting bearer token is stored in `/var/lib/vizio-app-redirect/auth-token`, mode 600, inside a mode-700 directory. Neither the PIN nor token is printed or included in the repository. Pairing may interrupt the current TV view. It uses a separate pairing identity from other TV clients.

Visually confirm that the destination page loads and remote navigation works. Sign into that app through its normal login/Quick Connect flow. Do not put credentials or API keys in a destination URL. The TV's own browser holds its app session; the monitor does not handle Jellyfin login.

## Choose another source app or button

Open the app/shortcut you want to redirect, then capture its current state:

```sh
python3 /usr/local/libexec/vizio-app-redirect.py capture
```

Copy that local result's three values into `trigger` in `/etc/vizio-app-redirect.json`. Preserve types: APP_ID is a string, NAME_SPACE an integer, MESSAGE an exact string or `null` as captured. JSON descriptor messages must be escaped as JSON strings. The destination MESSAGE must always be a webpage URL string. Do not broaden the match to an app name, a URL substring, or only an app ID. The included trigger is merely the measured Crackle deployment example.

Repeat captures for normal paths you want to preserve. If they return the same triple, this software cannot distinguish them. If the remote button does nothing, there is no state change for this monitor to detect. Choose a different shortcut or investigate separate hardware IR detection.

`capture` deliberately prints the raw app state locally. Another app's MESSAGE may contain private URLs or account data. Redact it before sharing, and never commit capture output, local config, tokens or pairing values.

## Observe before redirecting

```sh
python3 /usr/local/libexec/vizio-app-redirect.py observe
```

Start from Home. Open normal apps and preserved WatchFree+ paths: no `Would launch configured webfront` message should appear. Return Home, press the chosen shortcut, and check that the message appears once. Stop with Ctrl-C. Then try the live monitor:

```sh
python3 /usr/local/libexec/vizio-app-redirect.py run
```

Repeat both paths and confirm the TV display. Stop with Ctrl-C before starting a service. The first successful sample and the first sample after a connection failure only establish a baseline; they never launch. If starting while the trigger is already active, go Home and press the shortcut again.

The monitor polls every 0.5 seconds, permits at most one launch per eight seconds, and stops before a fourth launch within 60 seconds. Holding/repeatedly pressing a button may be suppressed. A launch failure stops the live monitor; connection-read failures wait for recovery. A local file lock prevents two instances of this generic script, including pairing, from running simultaneously. Stop any older deployment-specific monitor separately.

## Optional systemd service

After the foreground tests pass and pairing has created the state directory:

```sh
install -m 0644 ./vizio-app-redirect.service /etc/systemd/system/vizio-app-redirect.service
systemctl daemon-reload
systemctl enable --now vizio-app-redirect.service
systemctl status --no-pager vizio-app-redirect.service
journalctl -u vizio-app-redirect.service -n 50 --no-pager
```

The service intentionally uses `Restart=no`: invalid tokens and loop safety stops require inspection instead of automatic retries. It runs as root to read root-only state, with filesystem restrictions and no new privileges. It only needs outbound TV API access. The configuration and source are trusted administrator inputs.

## Repair, change destination, or remove

For invalid pairing, stop the service, re-pair, then restart:

```sh
systemctl stop vizio-app-redirect.service
python3 /usr/local/libexec/vizio-app-redirect.py pair
systemctl start vizio-app-redirect.service
```

For a different destination, stop the service, edit the local JSON, test `launch-once`, repeat observation/live checks, and start the service. If the trigger changed after firmware updates, recapture and compare all preserved routes. For an app loading problem, check the webfront's availability from the TV and its browser compatibility; API acceptance is not proof of webpage rendering.

To disable redirecting immediately:

```sh
systemctl disable --now vizio-app-redirect.service
```

This restores the shortcut's ordinary TV behavior once no monitor is running. You can then remove the installed unit/script/config using your normal administrator tools. Revoke the monitor's pairing in the TV's paired-device controls if available; deleting a local token alone does not revoke the TV-side authorization. Jellyfin adapter recovery remains documented in the main README.

## Privacy and verification limits

Public examples contain placeholder hosts and no deployment credentials. The monitor contacts only the configured TV control API and asks the TV to load the configured destination; no analytics, cloud callback, shell command execution, or package downloads are included. Runtime logs omit full URLs and tokens. TV API HTTP redirects and environment proxies are disabled so the AUTH header is not forwarded elsewhere.

SmartCast's self-signed certificate requires a client-specific certificate exception. This does not authenticate the TV against an active network attacker. Keep the control network trusted. Use a trusted webfront: its scripts execute in the TV browser and receive that site's browser/session privileges. The monitor does not audit that app, its media, the TV firmware or upstream services.

The small publication review was static. No complete runtime security assessment or fresh physical-TV regression of this generalized release was performed. See [SECURITY.md](SECURITY.md).
