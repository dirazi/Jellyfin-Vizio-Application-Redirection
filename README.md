# Vizio SmartCast Jellyfin through Conjure

A proof of concept that makes a Jellyfin-hosted webpage usable with a VIZIO TV remote when launched through Conjure.

**Only tested TV model: VIZIO V4K65X-0810.** The project was developed against a Jellyfin installation reporting **12.1.0**, using the Debian native-package webroot `/usr/share/jellyfin/web`. Other TV models, firmware versions, Jellyfin versions and deployment layouts are untested.

The TV successfully loaded Jellyfin Web and completed Quick Connect during development. Arrow keys, Enter/OK and Backspace/Back were observed. Remote navigation has been iterated using owner feedback. This publication includes security precautions added after that testing; the complete published revision still needs a fresh TV regression pass. It is experimental, and some playback, focus, movie activation or season-selection behavior may need further work.

## What the TV launches

This project creates a **backend-hosted webpage location for VIZIO TVs to launch to**:

```text
http://JELLYFIN_HOST:8096/web/vizio.html?vizioNav=1
```

Replace `JELLYFIN_HOST` with the address your TV can reach. This is a separate HTML entry page and JavaScript served by your existing Jellyfin backend. It is not a native SmartCast application, a replacement Jellyfin server or an authentication proxy. No API key belongs in this URL.

The installer copies Jellyfin's installed `index.html` to `vizio.html` and adds four local script references. The ordinary `index.html` is preserved. Each adapter also checks the Vizio entry path and `vizioNav=1` before enabling its handlers. Other clients using Jellyfin's ordinary URL continue to use their normal page. Any browser deliberately opening the opt-in URL gets the adapter; this is URL isolation, not automatic TV-model detection or access control.

## Launch with Conjure

Use the [VIZIO SmartCast Conjure launcher](https://vizio-pm.s3-us-west-1.amazonaws.com/conjure-launcher.html) from a device that can reach your TV. This third-party launcher initially asks for the TV's IP address and then the four-digit PIN displayed on the TV.

1. Install the files on the machine or container that actually serves Jellyfin Web, following the instructions below.
2. Confirm that the TV can reach your Jellyfin address. Keep Jellyfin on a trusted LAN or a properly secured private connection; the repository does not require making your media server publicly reachable.
3. Open the linked Conjure launcher, enter your TV's IP address and complete its on-screen PIN flow. Keep pairing values private.
4. In Conjure's webpage-launch flow, supply your complete Jellyfin Vizio entry URL shown above. The exact controls after pairing depend on the launcher/TV; this repository does not modify that launcher.
5. On the TV, select Jellyfin's **Use Quick Connect** option. Approve the TV's code from an already signed-in Jellyfin client using Jellyfin's [Quick Connect flow](https://jellyfin.org/docs/general/server/quick-connect/). This avoids typing a password with the remote. Quick Connect must be enabled on your server.

The launcher is an external service. This repository neither supplies nor stores TV pairing tokens, Jellyfin credentials or the contents of your Jellyfin session. Do not paste them into issues or commit them.

## Intended controls

| Action | Intended behavior |
| --- | --- |
| Arrow keys while browsing | Move a yellow outline between visible controls |
| OK / Enter on a movie or episode | Invoke Jellyfin's native Play/Resume action when available; otherwise open details |
| OK on a series | Open its season chooser; selecting a season opens its episodes |
| Arrow keys / OK during playback | First reveal on-screen controls; subsequent presses navigate or activate controls instead of raw seek shortcuts |
| Back / Backspace | Use Jellyfin's existing Back action to leave playback, season selection or episode selection |

The browsing filter skips duplicate card-title links, card management overlays such as favorite/watched/more, metadata links and external IMDb/TMDB links. The adapter does not delete those records or remove server permissions. Player dialogs, subtitles and edge cases need checking on the actual TV. This project supplies no on-screen keyboard.

## Install on Debian native packages

The scripts use fixed native-package paths and Linux/GNU utilities. Docker, Windows and alternative webroots are not supported by these scripts. Do not run them on a Proxmox host just because Jellyfin is inside an LXC: run inside the Jellyfin container. They do not change media, transcode settings or Plex.

Use a reviewed, root-owned checkout outside the served webroot. The installers reject symlinks, hard-linked files, non-root ownership and group/world-writable source or destination paths. They use files next to the installer, not an arbitrary working directory. A shared `/tmp` staging path is intentionally rejected.

For an existing root shell inside the Jellyfin container:

```sh
set -eu
cd /root
git clone https://github.com/dirazi/Vizio-TV-SmartCast-Jellyfin.git vizio-jellyfin-conjure
cd /root/vizio-jellyfin-conjure
# Review the files before executing a privileged installer.
sh -n ./install-vizio-nav.sh
df -h /usr/share/jellyfin/web /var/backups
sha256sum /usr/share/jellyfin/web/index.html
sh ./install-vizio-nav.sh
sha256sum /usr/share/jellyfin/web/index.html
```

If using a normal account on a Debian host, obtain a root-owned checkout with sudo:

```sh
sudo git clone https://github.com/dirazi/Vizio-TV-SmartCast-Jellyfin.git /root/vizio-jellyfin-conjure
sudo sh -n /root/vizio-jellyfin-conjure/install-vizio-nav.sh
sudo sh /root/vizio-jellyfin-conjure/install-vizio-nav.sh
```

If the checkout directory already exists, inspect it rather than cloning over it. Review and pin a commit you trust before installing. The repository does not download or execute more code during installation.

Fresh installation refuses to overwrite existing trial files. It saves a timestamp/PID backup of `index.html` under `/var/backups/jellyfin-vizio/`, creates `vizio.html` and the four adapters, and prints the backup path. Save that path. No Jellyfin restart is required. A failed backup or low disk space must be resolved before retrying.

## Update an existing trial

Transfer or obtain the reviewed release files into the root-owned checkout first. These commands update browsing/card/Back behavior and then the player helper, with a separate printed backup directory for each operation:

```sh
set -eu
cd /root/vizio-jellyfin-conjure
sh -n ./update-vizio-card-actions.sh
sh -n ./update-vizio-player.sh
df -h /usr/share/jellyfin/web /var/backups
sh ./update-vizio-card-actions.sh
sh ./update-vizio-player.sh
```

Use `sudo sh /root/vizio-jellyfin-conjure/SCRIPT_NAME.sh` if running from a normal account. `update-vizio-movie-play.sh` is retained for an isolated card-activation update; it is not a substitute for updating the Back helper's diagnostic fix.

Updates stage files, compare copied JavaScript and retain backups. Replacements across several files are sequential, **not one atomic transaction**. Keep the TV closed while updating and keep both printed backup paths. If an update fails after a replacement, restore the corresponding backed-up files or remove the trial and reinstall. Do not assume a failed update restored itself.

## Simple validation

From a device that can reach your own server, replace the example host, then run:

```sh
JELLYFIN_URL=http://JELLYFIN_HOST:8096
curl -fsS "$JELLYFIN_URL/web/vizio.html" | grep -F 'vizio-back-nav.js?v=4'
curl -fsS "$JELLYFIN_URL/web/vizio-remote-nav.js" | head -c 100
normal_entry=$(mktemp)
trap 'rm -f -- "$normal_entry"' EXIT HUP INT TERM
curl -fsS "$JELLYFIN_URL/web/index.html" -o "$normal_entry"
if grep -Fq 'vizio-remote-nav.js' "$normal_entry"; then
    echo 'Unexpected adapter reference in the normal entry page; inspect before continuing.'
else
    echo 'No adapter reference in the normal entry page.'
fi
```

Compare the before/after local `index.html` hashes as well. Then check the normal Jellyfin URL on a laptop, launch the opted-in URL on the TV, and test: login/Quick Connect, Home, Movies, Shows, a multi-season series, episode selection, subtitles while paused and playing, Back from playback, and Back from season/episode pages. Check that one OK press triggers only one action. Reopen Conjure after changes; a new query parameter such as `&trial=2` may help with a cached entry page.

For temporary navigation diagnostics append `&vizioDiag=1`. The publication revision displays only fixed navigation names or `[input]` / `[other]`; it does not display typed characters or numeric key codes. Turn diagnostics off for normal use. Never use real credentials in a diagnostic recording.

Jellyfin package upgrades can make the copied `vizio.html` stale. After an upgrade, remove/recreate the trial from the new installed `index.html` and repeat validation; there is no package hook or automatic compatibility guarantee.

## Recovery and removal

For an update rollback, use the printed backup directories and restore the exact affected files from each update, in reverse update order. The player updater backs up `vizio.html` and the old player helper if present; the card updater backs up `vizio.html` and the old remote/Back/card helpers if present. A missing backup helper means that helper did not exist before that operation; remove its newly added copy when undoing that operation. Inspect the backup directory before copying anything, and do not restore an unrelated `index.html` over the current package version.

The simplest way to stop using the adapter is to launch Jellyfin's ordinary URL and close the opted-in page. To remove the trial files as root:

```sh
set -eu
web=/usr/share/jellyfin/web
test "$(readlink -f "$web")" = "$web"
rm -f -- "$web/vizio.html" "$web/vizio-remote-nav.js" \
    "$web/vizio-player-nav.js" "$web/vizio-movie-play.js" "$web/vizio-back-nav.js"
```

Then close/relaunch Conjure. `index.html` is not part of this removal. Backups stay in `/var/backups/jellyfin-vizio` for inspection. Removing these files does not revoke a Jellyfin session; use Jellyfin's own account/device controls if you need to sign a TV out.

## Security and validation status

See [SECURITY.md](SECURITY.md) for the trust boundaries, source-review results, publication changes and unperformed runtime checks. No claim is made that attacks are impossible. Keep Jellyfin itself updated, retain its normal authentication, and do not weaken network or browser protections to make this adapter work.

This is an independent proof of concept, not an official Jellyfin or VIZIO product. No third-party Jellyfin web bundle, account data, logs, pairing data or host configuration is included.
