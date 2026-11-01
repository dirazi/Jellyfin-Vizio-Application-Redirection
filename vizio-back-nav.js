/* Vizio Back/Exit, revision 4. */
(function () {
    'use strict';
    if (!/\/web\/vizio\.html$/.test(window.location.pathname) ||
        !/(?:^|[?&])vizioNav=1(?:&|$)/.test(window.location.search)) return;
    if (window.__vizioBackNavInstalled) return;
    window.__vizioBackNavInstalled = true;
    var held = false;
    var debug = /(?:^|[?&])vizioDiag=1(?:&|$)/.test(window.location.search);
    function report(message) {
        if (!debug || !document.body) return;
        var box = document.getElementById('vizio-back-status');
        if (!box) {
            box = document.createElement('div');
            box.id = 'vizio-back-status';
            box.style.cssText = 'position:fixed;left:16px;bottom:16px;z-index:2147483647;background:#111;color:#fff;padding:10px;font:18px sans-serif;pointer-events:none';
            document.body.appendChild(box);
        }
        box.textContent = 'Vizio Back v4 | movie: ' + (window.__vizioMoviePlayInstalled ? 'loaded' : 'missing') + ' | ' + message;
    }
    function ready() { report('ready'); }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ready);
    else ready();
    function diagnosticKey(e) {
        var target = e.target || document.activeElement;
        if (target && target.closest && target.closest('input,textarea,select,[contenteditable]:not([contenteditable="false"]),[role="textbox"]')) return '[input]';
        if (isBack(e)) return 'Back';
        if (/^(ArrowUp|ArrowDown|ArrowLeft|ArrowRight|Enter|Tab)$/.test(e.key || '')) return e.key;
        return '[other]';
    }
    function isBack(e) {
        return /^(Back|Backspace|Escape|BrowserBack|GoBack)$/.test(e.key || '') ||
            [8, 27, 461, 10009].indexOf(e.keyCode) >= 0;
    }
    function playerVisible() {
        return Array.prototype.some.call(document.querySelectorAll('#videoOsdPage'), function (el) {
            var r = el.getBoundingClientRect();
            return !el.closest('.hide,[hidden],[aria-hidden="true"]') &&
                window.getComputedStyle(el).display !== 'none' && r.width > 1 && r.height > 1;
        });
    }
    function consume(e) { e.preventDefault(); e.stopImmediatePropagation(); }
    window.addEventListener('keydown', function (e) {
        if (debug) {
            var active = document.activeElement;
            var item = active && active.closest ? active.closest('[data-type]') : null;
            report('key=' + diagnosticKey(e) + ' item=' + (item ? item.getAttribute('data-type') : 'none'));
        }
        if (!isBack(e) || e.ctrlKey || e.altKey || e.metaKey) return;
        if (!held && !playerVisible() && !(window.Emby && window.Emby.Page && window.Emby.Page.canGoBack())) return;
        consume(e);
        if (held || e.repeat) return;
        held = true;
        var button = document.querySelector('.osdHeader .headerBackButton,.skinHeader .headerBackButton');
        if (button && !button.disabled) button.click();
        else window.history.back();
    }, true);
    window.addEventListener('keyup', function (e) {
        if (isBack(e) && held) { consume(e); held = false; }
    }, true);
    window.addEventListener('blur', function () { held = false; report('ready'); });
    document.addEventListener('focusin', function () { report('ready'); }, true);
})();

/* Update the diagnostic item after focus actually moves. */
(function () {
    'use strict';
    if (!/\/web\/vizio\.html$/.test(window.location.pathname) ||
        !/(?:^|[?&])vizioNav=1(?:&|$)/.test(window.location.search) ||
        !/(?:^|[?&])vizioDiag=1(?:&|$)/.test(window.location.search)) return;
    if (window.__vizioFocusStatusFixed) return;
    window.__vizioFocusStatusFixed = true;
    document.addEventListener('focusin', function (event) {
        var target = event.target;
        if (!target || !target.closest) return;
        var item = target.closest('.card[data-type]') || target.closest('[data-type]');
        var box = document.getElementById('vizio-back-status');
        if (!box) return;
        var value = 'item=' + (item ? item.getAttribute('data-type') : 'none');
        box.textContent = /item=[^\s|]+/.test(box.textContent) ?
            box.textContent.replace(/item=[^\s|]+/, value) : box.textContent + ' ' + value;
    }, true);
})();
