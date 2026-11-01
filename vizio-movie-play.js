/* Vizio Jellyfin Web 12.1 card activation, revision 3. */
(function () {
    'use strict';
    if (!/\/web\/vizio\.html$/.test(window.location.pathname) ||
        !/(?:^|[?&])vizioNav=1(?:&|$)/.test(window.location.search)) return;
    if (window.__vizioMoviePlayInstalled) return;
    window.__vizioMoviePlayInstalled = true;

    window.__vizioCardActionsVersion = 3;
    var internalClick = false, releasePending = false, lastId = '', lastTime = 0, keyClickUntil = 0;
    function cardFor(el) {
        return el && el.closest ? el.closest('.card[data-id][data-type],.listItem[data-id][data-type]') : null;
    }
    function playerOpen() {
        return Array.prototype.some.call(document.querySelectorAll('#videoOsdPage'), function (el) {
            var r = el.getBoundingClientRect();
            return !el.closest('.hide,[hidden],[aria-hidden="true"]') && r.width > 1 && r.height > 1;
        });
    }
    function supported(card) {
        return card && /^(Movie|Series|Season|Episode)$/.test(card.getAttribute('data-type'));
    }
    function consume(e) { e.preventDefault(); e.stopImmediatePropagation(); }
    function report(text) {
        window.__vizioLastCardAction = text;
        var box = document.getElementById('vizio-back-status');
        if (box) box.textContent = box.textContent.replace(/ \| action=.*$/, '') + ' | action=' + text;
    }
    function browse(card) {
        var router = window.Emby && window.Emby.Page;
        if (router && typeof router.showItem === 'function') {
            router.showItem({
                Id: card.getAttribute('data-id'), Type: card.getAttribute('data-type'),
                ServerId: card.getAttribute('data-serverid'), MediaType: card.getAttribute('data-mediatype'),
                IsFolder: card.getAttribute('data-isfolder') === 'true'
            });
            return true;
        }
        var link = card.querySelector('a.cardImageContainer[href],a.cardContent[href],a.textActionButton[href]');
        if (link && link.hash && link.hash !== '#') { window.location.hash = link.hash; return true; }
        return false;
    }
    function activate(card) {
        var type = card.getAttribute('data-type');
        var id = type + ':' + card.getAttribute('data-id'), now = Date.now();
        if (id === lastId && now - lastTime < 700) return;
        lastId = id; lastTime = now;
        if (type === 'Series' || type === 'Season') {
            report(type + (browse(card) ? ': browse' : ': browse action unavailable'));
            return;
        }
        var play = card.querySelector('.cardOverlayFab-primary,.cardOverlayButton-centered,[data-action="play"],[data-action="resume"]');
        if (play && !play.disabled && play.getAttribute('aria-disabled') !== 'true') {
            internalClick = true;
            try { play.click(); } finally { internalClick = false; }
            report(type + ': native play');
            return;
        }
        if (!play) {
            var accepted = !card.dispatchEvent(new CustomEvent('command', {
                detail: { command: 'play' }, bubbles: true, cancelable: true
            }));
            if (accepted) { report(type + ': native play command'); return; }
        }
        report(type + ': play unavailable; ' + (browse(card) ? 'opened details' : 'no action'));
    }
    window.addEventListener('keydown', function (e) {
        if (e.ctrlKey || e.altKey || e.metaKey || e.shiftKey || playerOpen()) return;
        if (e.key !== 'Enter' && e.keyCode !== 13) return;
        var card = cardFor(document.activeElement);
        if (!supported(card)) return;
        consume(e);
        if (e.repeat) return;
        releasePending = true;
        keyClickUntil = Date.now() + 700;
        activate(card);
    }, true);
    window.addEventListener('keyup', function (e) {
        if ((e.key === 'Enter' || e.keyCode === 13) && releasePending) { consume(e); releasePending = false; }
    }, true);
    window.addEventListener('blur', function () { releasePending = false; });
    document.addEventListener('click', function (e) {
        if (internalClick || e.ctrlKey || e.altKey || e.metaKey || e.shiftKey || e.button > 0) return;
        var card = cardFor(e.target);
        if (!supported(card)) return;
        if (e.target.closest('.cardOverlayButton-br,.btnCardOptions')) return;
        if (Date.now() < keyClickUntil) { consume(e); return; }
        if (playerOpen()) return;
        consume(e);
        activate(card);
    }, true);
})();
