/* Vizio Jellyfin Web 12.1 player controls, revision 1. */
(function () {
    'use strict';
    if (!/\/web\/vizio\.html$/.test(window.location.pathname) ||
        !/(?:^|[?&])vizioNav=1(?:&|$)/.test(window.location.search)) return;
    if (window.__vizioPlayerNavInstalled) return;
    window.__vizioPlayerNavInstalled = true;

    var arrows = { ArrowLeft: 1, ArrowRight: 1, ArrowUp: 1, ArrowDown: 1 };
    var names = { 13: 'Enter', 37: 'ArrowLeft', 38: 'ArrowUp', 39: 'ArrowRight', 40: 'ArrowDown' };
    var selector = 'button,a[href],[role=button],[role=menuitem],[tabindex="0"]';
    function visible(el) {
        if (!el || el.disabled || el.getAttribute('aria-disabled') === 'true') return false;
        if (el.closest('.hide,[hidden],[aria-hidden="true"],.videoOsdBottom-hidden,.osdHeader-hidden')) return false;
        var cs = window.getComputedStyle(el), r = el.getBoundingClientRect();
        return cs.display !== 'none' && cs.visibility !== 'hidden' && r.width > 1 && r.height > 1;
    }
    function lastVisible(selector) {
        var nodes = Array.prototype.slice.call(document.querySelectorAll(selector)).filter(visible);
        return nodes.length ? nodes[nodes.length - 1] : null;
    }
    function player() { return lastVisible('#videoOsdPage'); }
    function dialog() {
        return lastVisible('.dialogContainer .dialog.opened,dialog[open],[role=dialog],[role=menu],[aria-modal="true"]');
    }
    function choices(root) {
        return Array.prototype.slice.call(root.querySelectorAll(selector)).filter(function (el) {
            return visible(el) && el.tabIndex >= 0 && !el.matches('input[type=range],[role=slider]');
        });
    }
    function mark(el) {
        if (!el) return;
        var old = document.querySelector('.vizio-remote-focused');
        if (old && old !== el) old.classList.remove('vizio-remote-focused');
        el.classList.add('vizio-remote-focused');
        try { el.focus({ preventScroll: true }); } catch (_) { el.focus(); }
        try { el.scrollIntoView({ block: 'nearest', inline: 'nearest' }); } catch (_) { el.scrollIntoView(false); }
    }
    function center(el) {
        var r = el.getBoundingClientRect();
        return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    }
    function next(current, list, key) {
        var a = center(current), best = null, score = Infinity;
        list.forEach(function (el) {
            if (el === current) return;
            var b = center(el), dx = b.x - a.x, dy = b.y - a.y;
            var primary = key === 'ArrowRight' ? dx : key === 'ArrowLeft' ? -dx : key === 'ArrowDown' ? dy : -dy;
            if (primary <= 2) return;
            var secondary = key === 'ArrowLeft' || key === 'ArrowRight' ? Math.abs(dy) : Math.abs(dx);
            var distance = primary + secondary * 2;
            if (distance < score) { score = distance; best = el; }
        });
        return best;
    }
    function consume(event) { event.preventDefault(); event.stopImmediatePropagation(); }
    window.addEventListener('keydown', function (event) {
        if (event.ctrlKey || event.altKey || event.metaKey) return;
        var key = names[event.keyCode] || event.key;
        if (!arrows[key] && key !== 'Enter') return;
        var view = player();
        if (!view) return;
        consume(event);
        var modal = dialog(), before = document.activeElement;
        var controls = view.querySelector('.videoOsdBottom-maincontrols');
        var wasHidden = !visible(controls);
        if (!modal) {
            // Jellyfin 12.1's info command opens the OSD and resets its idle timer.
            // It does not invoke seek, volume or play/pause commands.
            view.dispatchEvent(new CustomEvent('command', {
                detail: { command: 'info' }, bubbles: true, cancelable: true
            }));
        }
        var root = modal || view;
        var list = choices(root);
        if (!modal) {
            var header = document.querySelector('.osdHeader');
            if (visible(header)) list = list.concat(choices(header));
        }
        if (!list.length) return;
        var current = list.indexOf(before) >= 0 ? before : null;
        if (!modal && wasHidden) {
            var pause = view.querySelector('.btnPause');
            mark(list.indexOf(pause) >= 0 ? pause : list[0]);
            return;
        }
        if (arrows[key]) {
            mark(current ? next(current, list, key) || current : list[0]);
        } else if (!event.repeat) {
            if (current) current.click();
            else mark(list[0]);
        }
    }, true);
    window.addEventListener('keyup', function (event) {
        if (event.ctrlKey || event.altKey || event.metaKey) return;
        var key = names[event.keyCode] || event.key;
        if ((arrows[key] || key === 'Enter') && player()) consume(event);
    }, true);
})();
