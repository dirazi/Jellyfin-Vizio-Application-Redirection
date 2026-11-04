/* Jellyfin Web 12.1 Vizio/Conjure remote navigation, revision 11.
 * Opt in by opening /web/vizio.html?vizioNav=1 on the TV.
 * Other URLs leave Jellyfin's key handling untouched.
 */
(function () {
    'use strict';

    if (!/\/web\/vizio\.html$/.test(window.location.pathname) ||
        !/(?:^|[?&])vizioNav=1(?:&|$)/.test(window.location.search)) return;
    if (window.__vizioRemoteNavInstalled) return;
    window.__vizioRemoteNavInstalled = true;
    window.__vizioRemoteNavVersion = 11;

    var keys = { ArrowUp: 1, ArrowDown: 1, ArrowLeft: 1, ArrowRight: 1 };
    var selector = 'a[href],button,input,select,textarea,[role="button"],[role="menuitem"],[role="option"],[role="combobox"],[tabindex="0"]';
    var style = document.createElement('style');
    style.textContent = 'html.vizio-remote-nav .vizio-remote-focused{outline:4px solid #ffd54f!important;outline-offset:3px!important;box-shadow:0 0 0 5px rgba(0,0,0,.8)!important}';
    document.documentElement.appendChild(style);
    document.documentElement.classList.add('vizio-remote-nav');

    function visual(el) {
        return el && el.tagName === 'INPUT' && el.type === 'checkbox' ? el.closest('label') || el : el;
    }

    function visible(el) {
        if (!el || el.disabled || el.getAttribute('aria-disabled') === 'true') return false;
        if (el.closest('[hidden],[aria-hidden="true"],.hide')) return false;
        var cs = window.getComputedStyle(el);
        if (cs.display === 'none' || cs.visibility === 'hidden') return false;
        var r = visual(el).getBoundingClientRect();
        return r.width > 1 && r.height > 1;
    }

    function scope() {
        var dialogs = Array.prototype.slice.call(document.querySelectorAll('dialog[open],[role="dialog"],[aria-modal="true"],[role="menu"],[role="listbox"]')).filter(visible);
        return dialogs.length ? dialogs[dialogs.length - 1] : document;
    }

    function choices() {
        var root = scope();
        return Array.prototype.slice.call(root.querySelectorAll(selector)).filter(function (el) {
            return visible(el) && (el.tabIndex >= 0 || ['menuitem', 'option'].indexOf(el.getAttribute('role')) >= 0) && !el.matches('.card .cardText a.textActionButton,.card .cardOverlayButton,.card .btnCardOptions,.card .cardOverlayButton-br button') && !el.closest('.itemDetailsGroup,.detailsGroupItem,.itemTags,.itemExternalLinks');
        });
    }

    var topBarSelector = '.MuiToolbar-root,.headerTop,.skinHeader,.MuiAppBar-root,[role="tablist"],.emby-tabs,header,[role="banner"]';
    // Match the library rail, not the alphaPicker used as a search keyboard.
    var alphabetSelector = '.alphaPicker-fixed-right,.alphaPicker-vertical';
    var cardSelector = '.card[data-id],.listItem[data-id]';
    var pageSelector = '.mainAnimatedPage,.page,[data-role="page"],main,[role="main"]';

    function reveal(el) {
        var node = visual(el), safeTop = 16;
        Array.prototype.forEach.call(document.querySelectorAll('.skinHeader,.MuiAppBar-root,header,[role="banner"]'), function (bar) {
            if (!visible(bar) || bar.contains(el)) return;
            var cs = window.getComputedStyle(bar), r = bar.getBoundingClientRect();
            if ((cs.position === 'fixed' || cs.position === 'sticky') &&
                r.top <= 16 && r.bottom > 0 && r.bottom < window.innerHeight / 2) {
                safeTop = Math.max(safeTop, r.bottom + 16);
            }
        });
        node.style.scrollMarginTop = safeTop + 'px';
        node.style.scrollMarginBottom = '16px';
        try { node.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'instant' }); }
        catch (_) { node.scrollIntoView(false); }
    }

    function mark(el) {
        var old = document.querySelector('.vizio-remote-focused');
        if (old && old !== el) old.classList.remove('vizio-remote-focused');
        if (!el) return;
        visual(el).classList.add('vizio-remote-focused');
        try { el.focus({ preventScroll: true }); } catch (_) { el.focus(); }
        reveal(el);
    }

    function center(el) {
        var r = visual(el).getBoundingClientRect();
        return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    }

    function sameRow(a, b) {
        var overlap = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
        return overlap >= Math.min(a.height, b.height) / 2;
    }

    function card(el) { return el.closest(cardSelector); }
    function alphabet(el) { return el.closest(alphabetSelector); }
    function inBar(el) { return !!el.closest(topBarSelector); }

    function nearest(current, list, key) {
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

    function cardStep(current, list, key) {
        var currentCard = card(current), row = currentCard.getBoundingClientRect();
        var vertical = key === 'ArrowUp' || key === 'ArrowDown';
        var a = center(currentCard), closestRow = null, distance = Infinity;
        var candidates = list.filter(function (el) {
            var item = card(el);
            if (!item || item === currentCard) return false;
            var r = item.getBoundingClientRect(), b = center(item);
            var primary = key === 'ArrowDown' ? b.y - a.y : key === 'ArrowUp' ? a.y - b.y :
                key === 'ArrowRight' ? b.x - a.x : a.x - b.x;
            if (primary <= 2 || sameRow(row, r) === vertical) return false;
            if (primary < distance) { distance = primary; closestRow = r; }
            return true;
        });
        if (!vertical) return nearest(current, candidates, key);
        // Reach the adjacent row even when its cards are far across the page.
        var best = null, offset = Infinity;
        candidates.forEach(function (el) {
            if (!sameRow(closestRow, card(el).getBoundingClientRect())) return;
            var dx = Math.abs(center(card(el)).x - a.x);
            if (dx < offset) { offset = dx; best = el; }
        });
        return best;
    }

    function next(current, list, key) {
        // Open settings/dropdowns retain their existing isolated navigation.
        if (scope() !== document) return nearest(current, list, key);
        var rail = alphabet(current), item = card(current), target;
        var headers = list.filter(inBar);
        if (rail) {
            var letters = list.filter(function (el) { return alphabet(el) === rail; });
            if (key === 'ArrowRight') return null;
            if (key === 'ArrowLeft') {
                return nearest(current, list.filter(function (el) { return !!card(el); }), key);
            }
            // A is the top exit. The optional # entry also exits upward.
            var value = (current.getAttribute('data-value') || current.getAttribute('value') || current.textContent || '').trim().toUpperCase();
            if (key === 'ArrowUp' && (value === 'A' || value === '#')) {
                return nearest(current, headers, key);
            }
            target = nearest(current, letters, key);
            return target || (key === 'ArrowUp' ? nearest(current, headers, key) : null);
        }
        if (inBar(current) && (key === 'ArrowLeft' || key === 'ArrowRight')) {
            var row = visual(current).getBoundingClientRect();
            // Header tabs and SyncPlay can live in separate toolbar children.
            return nearest(current, headers.filter(function (el) {
                return sameRow(row, visual(el).getBoundingClientRect());
            }), key);
        }
        if (item) {
            var page = current.closest(pageSelector) || document;
            var cards = list.filter(function (el) { return card(el) && (el.closest(pageSelector) || document) === page; });
            target = cardStep(current, cards, key);
            if (target) return target;
            if (key === 'ArrowUp') return nearest(current, headers, key);
            if (key === 'ArrowRight') {
                return nearest(current, list.filter(function (el) { return !!alphabet(el); }), key);
            }
            // Bottom and left edges stay in the cards; never wrap to the header.
            return null;
        }
        return nearest(current, list, key);
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
            visual(event.target).classList.add('vizio-remote-focused');
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
        } else if (event.key === 'Enter' && active && ['menuitem', 'option'].indexOf(active.getAttribute('role')) >= 0) {
            event.preventDefault();
            event.stopImmediatePropagation();
            if (!event.repeat) active.click();
        } else if (event.key === 'Enter' && active && active.getAttribute('role') === 'button' && !/^(A|BUTTON|INPUT|SELECT|TEXTAREA)$/.test(active.tagName)) {
            event.preventDefault();
            event.stopImmediatePropagation();
            active.click();
        }
    }, true);
})();
