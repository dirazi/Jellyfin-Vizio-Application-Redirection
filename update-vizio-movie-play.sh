#!/bin/sh
set -eu

# Privileged installation accepts only a root-owned, non-writable checkout.
PATH=/usr/sbin:/usr/bin:/sbin:/bin
export PATH
LC_ALL=C
export LC_ALL
umask 077
test "$(id -u)" -eq 0 || { echo 'Run as root or with sudo.' >&2; exit 1; }
fail() { echo "$*" >&2; exit 1; }
trusted_dir() {
    checked_path=$1
    while :; do
        test -d "$checked_path" && test ! -L "$checked_path" || fail "Unsafe directory: $checked_path"
        test "$(stat -c %u -- "$checked_path")" = 0 || fail "Directory must be root-owned: $checked_path"
        checked_mode=$(stat -c %a -- "$checked_path")
        test "$((0$checked_mode & 022))" -eq 0 || fail "Directory writable by others: $checked_path"
        test "$checked_path" != / || break
        checked_path=$(dirname -- "$checked_path")
    done
}
trusted_file() {
    test -f "$1" && test ! -L "$1" || fail "Expected a regular, non-symlink file: $1"
    test "$(stat -c %u -- "$1")" = 0 || fail "File must be root-owned: $1"
    test "$(stat -c %h -- "$1")" = 1 || fail "Refusing hard-linked file: $1"
    checked_mode=$(stat -c %a -- "$1")
    test "$((0$checked_mode & 022))" -eq 0 || fail "File writable by others: $1"
}
test ! -L "$0" || fail 'Refusing a symlinked installer.'
source_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd -P)
trusted_dir "$source_dir"
trusted_file "$source_dir/$(basename -- "$0")"
cd -- "$source_dir"
trusted_dir /usr/share/jellyfin/web
trusted_dir /var/backups
if test -e /var/backups/jellyfin-vizio || test -L /var/backups/jellyfin-vizio; then
    trusted_dir /var/backups/jellyfin-vizio
fi
trusted_file /usr/share/jellyfin/web/index.html
for checked_file in vizio-remote-nav.js vizio-player-nav.js vizio-movie-play.js vizio-back-nav.js; do
    trusted_file "$source_dir/$checked_file"
done
for checked_file in vizio.html vizio-remote-nav.js vizio-player-nav.js vizio-movie-play.js vizio-back-nav.js; do
    if test -e "/usr/share/jellyfin/web/$checked_file" || test -L "/usr/share/jellyfin/web/$checked_file"; then
        trusted_file "/usr/share/jellyfin/web/$checked_file"
    fi
done

web=/usr/share/jellyfin/web
page="$web/vizio.html"
target="$web/vizio-movie-play.js"
backup_dir="/var/backups/jellyfin-vizio/movie-play-$(date +%Y%m%d-%H%M%S)-$$"
test "$(id -u)" -eq 0 || { echo 'Run as root inside the Jellyfin container, or with sudo.' >&2; exit 1; }
test -f "$page" && test -f ./vizio-movie-play.js || { echo 'Missing Vizio page or movie adapter file.' >&2; exit 1; }
grep -Fq 'vizio-remote-nav.js' "$page"
test "$(grep -c '</body>' "$page" || true)" -eq 1 || { echo 'Expected one closing body tag.' >&2; exit 1; }
df -Pk "$web" | awk 'NR == 2 { exit ($4 < 1024) }' || { echo 'Less than 1 MiB free. Free disk space before retrying.' >&2; exit 1; }
mkdir -p "$backup_dir"
cp -p "$page" "$backup_dir/vizio.html"
if test -f "$target"; then cp -p "$target" "$backup_dir/vizio-movie-play.js"; fi
page_tmp=$(mktemp "$web/.vizio-movie-page.XXXXXX")
script_tmp=
trap 'rm -f "$page_tmp"; if test -n "$script_tmp"; then rm -f "$script_tmp"; fi' EXIT HUP INT TERM
script_tmp=$(mktemp "$web/.vizio-movie-script.XXXXXX")
install -m 0644 ./vizio-movie-play.js "$script_tmp"
cmp -s ./vizio-movie-play.js "$script_tmp"
cp -p "$page" "$page_tmp"
if grep -Fq 'vizio-movie-play.js' "$page_tmp"; then
    sed -i 's/src="vizio-movie-play\.js[^"]*"/src="vizio-movie-play.js?v=3"/' "$page_tmp"
else
    sed -i '/<\/body>/i\<script src="vizio-movie-play.js?v=3"></script>' "$page_tmp"
fi
grep -Fq 'src="vizio-movie-play.js?v=3"' "$page_tmp"
mv "$script_tmp" "$target"
mv "$page_tmp" "$page"
trap - EXIT HUP INT TERM
echo "Movie poster playback installed. Backup: $backup_dir"
echo 'No Jellyfin restart is needed.'
