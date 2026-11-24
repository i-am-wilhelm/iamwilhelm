/* Horoskopos embeds: fits each embedded frame's height to its reading.
   Optional. Add it once to a page that holds Horoskopos <iframe>s without a fixed size:
     <script async src="https://iamwilhelm.com/machines/natal/embed.js"></script>
   The frame posts its content height; this sets that height on the frame it came from, and on no other. */
(function () {
  if (window.__horoskoposEmbed) return;
  window.__horoskoposEmbed = true;
  window.addEventListener('message', function (e) {
    var d = e.data;
    if (!d || d.type !== 'horoskopos:size' || !(d.height > 0) || d.height > 20000) return;
    var frames = document.querySelectorAll('iframe[src*="/horoskopos/embed"]');
    for (var i = 0; i < frames.length; i++) {
      var f = frames[i], origin = '';
      try { origin = new URL(f.src, location.href).origin; } catch (err) { origin = ''; }
      if (f.contentWindow === e.source && origin === e.origin) f.style.height = Math.ceil(d.height) + 'px';
    }
  });
})();
