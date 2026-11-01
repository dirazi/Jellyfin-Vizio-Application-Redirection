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


# Run as root inside the Jellyfin LXC, from a directory containing
# vizio-remote-nav.js. Native package layout only.
web=/usr/share/jellyfin/web
index="$web/index.html"
page="$web/vizio.html"
adapter="$web/vizio-remote-nav.js"
player_adapter="$web/vizio-player-nav.js"
movie_adapter="$web/vizio-movie-play.js"
back_adapter="$web/vizio-back-nav.js"
backup_dir=/var/backups/jellyfin-vizio
backup="$backup_dir/index.html.$(date +%Y%m%d-%H%M%S)-$$"

test "$(id -u)" -eq 0 || { echo 'Run with sudo or as root inside the LXC.' >&2; exit 1; }
test -f "$index" && test -f ./vizio-remote-nav.js && test -f ./vizio-player-nav.js && test -f ./vizio-movie-play.js || { echo 'Missing Jellyfin index.html or adapter file.' >&2; exit 1; }
test ! -e "$adapter" && test ! -e "$page" && test ! -e "$player_adapter" && test ! -e "$movie_adapter" || { echo 'Vizio page or adapter already exists; inspect before proceeding.' >&2; exit 1; }
test ! -e "$backup" || { echo "$backup already exists; retry after a second." >&2; exit 1; }
test -f ./vizio-back-nav.js && test ! -e "$back_adapter" || { echo 'Back adapter source missing or destination already exists.' >&2; exit 1; }
count=$(grep -c '</body>' "$index" || true)
test "$count" -eq 1 || { echo 'Expected exactly one </body> in index.html.' >&2; exit 1; }

mkdir -p "$backup_dir"
cp -p "$index" "$backup"
tmp=$(mktemp "$web/.vizio-index.XXXXXX")
installed=no
trap 'rm -f "$tmp"; if test "$installed" = no; then rm -f "$adapter" "$player_adapter" "$movie_adapter" "$back_adapter"; fi' EXIT HUP INT TERM
install -m 0644 ./vizio-remote-nav.js "$adapter"
install -m 0644 ./vizio-player-nav.js "$player_adapter"
install -m 0644 ./vizio-movie-play.js "$movie_adapter"
install -m 0644 ./vizio-back-nav.js "$back_adapter"
sed '/<\/body>/i\<script src="vizio-player-nav.js?v=1"></script><script src="vizio-movie-play.js?v=3"></script><script src="vizio-back-nav.js?v=4"></script><script src="vizio-remote-nav.js?v=8"></script>' "$index" > "$tmp"
grep -Fq '<script src="vizio-remote-nav.js?v=8"></script>' "$tmp"
chown --reference="$index" "$tmp"
chmod --reference="$index" "$tmp"
mv "$tmp" "$page"
installed=yes
trap - EXIT HUP INT TERM
echo "Installed without changing index.html. Backup: $backup"
echo 'TV URL: http://JELLYFIN_HOST:8096/web/vizio.html?vizioNav=1'
