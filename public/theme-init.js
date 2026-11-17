(function () {
  var dark = false;
  try {
    var pref = localStorage.getItem('shiftex-theme');
    dark = pref === 'dark' || ((!pref || pref === 'system') && window.matchMedia('(prefers-color-scheme: dark)').matches);
  } catch (e) {
    dark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  }
  document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
})();
