// Il tema prima del primo disegno (niente lampo chiaro→scuro). È un file e non uno script nella pagina: la CSP del server ammette solo script dello stesso sito.
try {
  var t = localStorage.getItem('theme');
  var system = matchMedia('(prefers-color-scheme: dark)').matches;
  var isPublic = /^\/(book|order|menu|privacy|terms|s)(\/|$)/.test(location.pathname);
  var dark = t === 'auto' ? system : t === 'light' ? false : t === 'dark' ? true : (isPublic ? system : true);
  if (dark) document.documentElement.classList.add('dark');
} catch { /* senza archivio locale: resta il chiaro */ }
