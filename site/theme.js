/* Runs before the page paints, so a dark-theme reader never sees a flash of light. Same storage
   key as every dukecodes page: a theme picked on one is kept on the others of the same site. */
(function () {
  var theme = null;
  try { theme = window.localStorage.getItem('dc-theme'); } catch (e) { theme = null; }
  if (theme !== 'light' && theme !== 'dark') {
    try { theme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'; } catch (e) { theme = 'light'; }
  }
  document.documentElement.setAttribute('data-theme', theme);
})();
