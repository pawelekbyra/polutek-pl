/* PP Support: drobne poprawki interfejsu po stronie przegladarki (wstrzykiwane przez Worker). Zadnych danych nie wysyla. */
(function () {
  var B = window.PP_BRAND || { name: 'PP Support', termsUrl: '', privacyUrl: '' };
  var TEST = /chatwoot/i;
  var ALL = /chatwoot/gi;
  var SKIP = 'script,style,textarea,input,pre,code,[contenteditable],[class*="bubble"],[class*="message-text"],[data-pp-keep]';
  var UPSELL = /^(upgrade( now| plan)?|learn more|read (the )?docs?|view docs|documentation|contact sales|see plans|view plans|buy now|start (free )?trial|ulepsz.*|dowiedz si[eę] wi[eę]cej|zobacz plany|dokumentacja)$/i;
  var HOST = /(^|\.)(chatwoot\.com|chwt\.app)$/i;

  function fix(str) { return str.replace(ALL, B.name); }

  function textNodes(root) {
    var w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    var n;
    while ((n = w.nextNode())) {
      if (n.nodeValue && TEST.test(n.nodeValue)) {
        var p = n.parentElement;
        if (p && !p.closest(SKIP)) n.nodeValue = fix(n.nodeValue);
      }
    }
  }
  function attrs(root) {
    root.querySelectorAll('[placeholder],[title],[aria-label],[alt]').forEach(function (el) {
      ['placeholder', 'title', 'aria-label', 'alt'].forEach(function (a) {
        var v = el.getAttribute(a);
        if (v && TEST.test(v) && !el.closest(SKIP)) el.setAttribute(a, fix(v));
      });
    });
  }
  function links(root) {
    root.querySelectorAll('a[href]').forEach(function (a) {
      var u;
      try { u = new URL(a.href, location.href); } catch (e) { return; }
      if (!HOST.test(u.hostname)) return;
      if (/terms/i.test(u.pathname) && B.termsUrl) { a.href = B.termsUrl; return; }
      if (/privacy/i.test(u.pathname) && B.privacyUrl) { a.href = B.privacyUrl; return; }
      a.classList.add('pp-hide');
    });
    root.querySelectorAll('a,button').forEach(function (el) {
      var t = (el.textContent || '').trim();
      if (t && t.length < 40 && UPSELL.test(t)) el.classList.add('pp-hide');
    });
    // Stopka z numerem wersji ("v4.x.x | Build ...").
    root.querySelectorAll('div,span,p').forEach(function (el) {
      if (el.children.length <= 3 && /^v\d+\.\d+\.\d+\s*\|?\s*Build/i.test((el.textContent || '').trim())) el.classList.add('pp-hide');
    });
  }
  function run() {
    var root = document.body;
    if (!root) return;
    textNodes(root); attrs(root); links(root);
    if (TEST.test(document.title)) document.title = fix(document.title);
  }
  var queued = false;
  function schedule() {
    if (queued) return;
    queued = true;
    (window.requestAnimationFrame || setTimeout)(function () { queued = false; run(); });
  }
  function start() {
    run();
    new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true, characterData: true });
  }
  if (document.body) start(); else document.addEventListener('DOMContentLoaded', start);
})();
