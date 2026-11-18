(function () {
  // Default is dark; the user can switch to light (or follow the device) in the app.
  var dark = true;
  try {
    var pref = localStorage.getItem('shiftex-theme');
    if (pref === 'light') dark = false;
    else if (pref === 'system') dark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    var a11y = JSON.parse(localStorage.getItem('shiftex-a11y') || '{}');
    var root = document.documentElement;
    if (a11y.scale) root.style.fontSize = a11y.scale + '%';
    if (a11y.contrast) root.setAttribute('data-contrast', 'high');
    if (a11y.links) root.setAttribute('data-links', 'underline');
    if (a11y.motion) root.setAttribute('data-motion', 'reduce');
  } catch (e) {
    /* storage unavailable: keep dark */
  }
  document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
})();
