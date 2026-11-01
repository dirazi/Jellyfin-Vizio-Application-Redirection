/* Jellyfin Web 12.1 Vizio/Conjure remote navigation trial.
 * Opt in by opening /web/vizio.html?vizioNav=1 on the TV.
 * Other URLs leave Jellyfin's key handling untouched.
 */
(function () {
    'use strict';

    if (!/\/web\/vizio\.html$/.test(window.location.pathname) ||
        !/(?:^|[?&])vizioNav=1(?:&|$)/.test(window.location.search)) return;
    if (window.__vizioRemoteNavInstalled) return;
    window.__vizioRemoteNavInstalled = true;

    var keys = { ArrowUp: 1, ArrowDown: 1, ArrowLeft: 1, ArrowRight: 1 };
    var selector = 'a[href],button,input,select,textarea,[role="button"],[tabindex="0"]';
    var style = document.createElement('style');
    style.textContent = 'html.vizio-remote-nav .vizio-remote-focused{outline:4px solid #ffd54f!important;outline-offset:3px!important;box-shadow:0 0 0 5px rgba(0,0,0,.8)!important}';
    document.documentElement.appendChild(style);
    document.documentElement.classList.add('vizio-remote-nav');

    function visible(el) {
        if (!el || el.disabled || el.getAttribute('aria-disabled') === 'true') return false;
        if (el.closest('[hidden],[aria-hidden="true"],.hide')) return false;
        var cs = window.getComputedStyle(el);
        if (cs.display === 'none' || cs.visibility === 'hidden') return false;
        var r = el.getBoundingClientRect();
        return r.width > 1 && r.height > 1;
    }

    function scope() {
        var dialogs = Array.prototype.slice.call(document.querySelectorAll('dialog[open],[role="dialog"],[aria-modal="true"]')).filter(visible);
        return dialogs.length ? dialogs[dialogs.length - 1] : document;
    }

    function choices() {
        var root = scope();
        return Array.prototype.slice.call(root.querySelectorAll(selector)).filter(function (el) {
            return visible(el) && el.tabIndex >= 0 && !el.matches('.card .cardText a.textActionButton,.card .cardOverlayButton,.card .btnCardOptions,.card .cardOverlayButton-br button') && !el.closest('.itemDetailsGroup,.detailsGroupItem,.itemTags,.itemExternalLinks');
        });
    }

    function mark(el) {
        var old = document.querySelector('.vizio-remote-focused');
        if (old && old !== el) old.classList.remove('vizio-remote-focused');
        if (!el) return;
        el.classList.add('vizio-remote-focused');
        try { el.focus({ preventScroll: true }); } catch (_) { el.focus(); }
        try { el.scrollIntoView({ block: 'nearest', inline: 'nearest' }); }
        catch (_) { el.scrollIntoView(false); }
    }

    function center(el) {
        var r = el.getBoundingClientRect();
        return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    }

    function next(current, list, key) {
        var a = center(current), best = null, bestScore = Infinity;
        list.forEach(function (el) {
            if (el === current) return;
            var b = center(el), dx = b.x - a.x, dy = b.y - a.y;
            var primary = key === 'ArrowRight' ? dx : key === 'ArrowLeft' ? -dx : key === 'ArrowDown' ? dy : -dy;
            if (primary <= 2) return;
            var secondary = key === 'ArrowRight' || key === 'ArrowLeft' ? Math.abs(dy) : Math.abs(dx);
            var score = primary + secondary * 2;
            if (score < bestScore) { bestScore = score; best = el; }
        });
        return best;
    }

    function isPlaying() {
        return Array.prototype.some.call(document.querySelectorAll('video'), function (v) {
            return !v.paused && !v.ended;
        });
    }

    document.addEventListener('focusin', function (event) {
        if (event.target && event.target.matches && event.target.matches(selector)) {
            var old = document.querySelector('.vizio-remote-focused');
            if (old && old !== event.target) old.classList.remove('vizio-remote-focused');
            event.target.classList.add('vizio-remote-focused');
        }
    });

    document.addEventListener('keydown', function (event) {
        if (event.altKey || event.ctrlKey || event.metaKey || isPlaying()) return;
        var active = document.activeElement;

        if (keys[event.key]) {
            var list = choices();
            if (!list.length) return;
            var current = list.indexOf(active) >= 0 ? active : null;
            var target = current ? next(current, list, event.key) : list[0];
            event.preventDefault();
            event.stopImmediatePropagation();
            if (!target) return;
            mark(target);
        } else if (event.key === 'Enter' && active && active.getAttribute('role') === 'button' && !/^(A|BUTTON|INPUT|SELECT|TEXTAREA)$/.test(active.tagName)) {
            event.preventDefault();
            event.stopImmediatePropagation();
            active.click();
        }
    }, true);
})();
