/* Tema Bci — aplica el Sistema de Diseño BCI (design_system_bci.json) al Árbol de Ideas.
 *
 * Todo valor visual sale del JSON: colores, tipografía, radios, sombras y los estilos de
 * botón / tarjeta / campo de texto. Para cambiar el diseño basta con editar el JSON.
 * Si el JSON no se puede cargar, el sitio se ve con su diseño original (no se rompe nada).
 *
 * Se carga de forma síncrona en <head> para que el diseño esté listo antes del primer render.
 */
(function () {
  var ds = null;
  try {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', 'design_system_bci.json?v=' + Date.now(), false);
    xhr.send(null);
    if (xhr.status >= 200 && xhr.status < 300 || xhr.status === 0 && xhr.responseText) {
      ds = JSON.parse(xhr.responseText).designSystem;
    }
  } catch (e) {
    console.warn('[Tema Bci] No se pudo cargar design_system_bci.json; se usa el diseño original.', e);
  }
  if (!ds) return;

  window.DESIGN_SYSTEM = ds;
  window.DS_FORCE_LIGHT = true; // el lienzo y las tarjetas usan la variante clara en todos los árboles
  document.documentElement.classList.add('theme-bci');

  // ---------- Resolución de referencias "{colors.palette.green.700}" ----------
  function get(path) {
    return path.split('.').reduce(function (o, k) { return o == null ? o : o[k]; }, ds);
  }
  function res(v) {
    if (typeof v !== 'string') return v;
    return v.replace(/\{([^}]+)\}/g, function (m, p) {
      var r = get(p);
      return r == null ? m : res(r);
    });
  }
  var kebab = function (k) { return k.replace(/[A-Z]/g, function (m) { return '-' + m.toLowerCase(); }); };

  // Propiedades de maquetación del JSON que NO se aplican a los botones/campos existentes
  // (la app es compacta; imponer 48px de alto / 32px de relleno rompería su distribución).
  var LAYOUT = /^(display|height|width|padding|justifyContent|alignItems|alignSelf|flexShrink|flex|flexDirection|gap|textAlign|position|left|top|fontSize|lineHeight)$/;
  function decl(styles, skipLayout) {
    return Object.keys(styles).filter(function (k) { return !(skipLayout && LAYOUT.test(k)); })
      .map(function (k) { return kebab(k) + ':' + res(styles[k]) + ' !important'; }).join(';');
  }

  var P = ds.colors.palette;
  var T = ds.typography;
  var R = ds.borderRadius;
  var SH = ds.shadows;
  var font = '"' + T.fontFamily.main + '", system-ui, -apple-system, "Segoe UI", sans-serif';
  var H = 'html.theme-bci ';
  var g = P.gray, gr = P.green, rd = P.red, yl = P.yellow, bl = P.blue;
  var TXT = res('{colors.semantic.text.primary}');

  var css = [];
  var add = function (sel, body) { css.push(sel + '{' + body + '}'); };

  // ---------- Variables CSS (útiles para cualquier ajuste futuro) ----------
  var vars = [];
  Object.keys(P).forEach(function (hue) {
    Object.keys(P[hue]).forEach(function (k) { vars.push('--ds-' + hue + '-' + k + ':' + P[hue][k]); });
  });
  vars.push('--ds-font:' + font);
  Object.keys(R).forEach(function (k) { vars.push('--ds-radius-' + kebab(k) + ':' + R[k]); });
  Object.keys(SH).forEach(function (k) { vars.push('--ds-shadow-' + k + ':' + SH[k]); });
  add('html.theme-bci', vars.join(';'));

  // ---------- Base: fondo, tipografía ----------
  add(H + 'body', 'background-color:' + res('{colors.semantic.background.default}') + ' !important;color:' + TXT + ';font-family:' + font);
  add('html.theme-bci.h-full', 'background-color:' + res('{colors.semantic.background.default}') + ';color:' + TXT);
  add(H + '.font-sans, ' + H + 'button, ' + H + 'input, ' + H + 'select, ' + H + 'textarea', 'font-family:' + font + ' !important');
  add(H + '#customBgOverlay', 'display:none');
  add(H + '.dot-grid', 'background-image:radial-gradient(rgba(61,79,92,.07) 1px,transparent 1px)');
  add(H + '#canvasContainer.canvas-light-theme',
    'background-color:' + P.white.main + ';background-image:radial-gradient(circle at 50% 35%,' + g[50] + ' 0%,rgba(255,255,255,0) 65%),radial-gradient(rgba(61,79,92,.07) 1px,transparent 1px);background-size:100% 100%,24px 24px');

  // Encabezado: el logo de la marca ocupa 120px, así que el título no debe partirse en líneas
  add(H + 'header h1, ' + H + 'header h1 span, ' + H + '#activeTreeSub, ' + H + 'header .xl\\:flex > div, ' + H + '#treePickerDropdownBtn', 'white-space:nowrap');
  add(H + 'header', 'padding-left:1rem;padding-right:1rem;gap:.75rem');
  add(H + 'header .xl\\:flex', 'gap:.5rem');
  add(H + 'header .xl\\:flex > div', 'padding-left:.6rem;padding-right:.6rem');
  add(H + 'header .xl\\:flex > div, ' + H + 'header .flex.items-center.gap-2 > button', 'flex-shrink:0');

  // ---------- Paneles ----------
  add(H + '.glass-panel, ' + H + '.glass-panel-light',
    'background:' + P.white.main + ' !important;backdrop-filter:none;border:1px solid ' + g[100] + ' !important;box-shadow:' + SH.sm);
  add(H + 'header.glass-panel', 'border-top:0 !important;border-left:0 !important;border-right:0 !important;border-bottom:1px solid ' + g[100] + ' !important');
  add(H + '.glass-panel .text-slate-300, ' + H + '.glass-panel .text-slate-400', 'color:' + g[600] + ' !important');
  add(H + '.glass-panel-light .text-emerald-300', 'color:' + gr[700] + ' !important');

  // ---------- Fondos (escala oscura de la app -> escala clara de la marca) ----------
  add(H + '.bg-slate-950, ' + H + '.bg-slate-900, ' + H + '[class*="bg-slate-900/"]', 'background-color:' + P.white.main);
  add(H + '.bg-slate-800, ' + H + '[class*="bg-slate-800/"], ' + H + '.bg-slate-100', 'background-color:' + g[50]);
  add(H + '.bg-slate-700, ' + H + '.hover\\:bg-slate-800:hover, ' + H + '.hover\\:bg-slate-700:hover', 'background-color:' + g[100]);
  add(H + '.bg-slate-950\\/97', 'background-color:rgba(255,255,255,.97)');
  add(H + '.bg-slate-950\\/85, ' + H + '.bg-slate-950\\/80', 'background-color:rgba(20,27,31,.45)');
  add(H + '.bg-slate-950\\/60, ' + H + '.bg-slate-950\\/70', 'background-color:' + g[50]);
  add(H + '.bg-emerald-950, ' + H + '[class*="bg-emerald-950/"]', 'background-color:' + gr[50]);
  add(H + '.bg-purple-950', 'background-color:' + bl[50]);

  // ---------- Bordes ----------
  add(H + '.border-slate-800, ' + H + '[class*="border-slate-800/"]', 'border-color:' + g[100]);
  add(H + '.border-slate-700, ' + H + '[class*="border-slate-700/"], ' + H + '[class*="border-slate-500/"]', 'border-color:' + g[200]);

  // ---------- Texto ----------
  add(H + '.text-white, ' + H + '.text-slate-100, ' + H + '.hover\\:text-white:hover', 'color:' + TXT);
  add(H + '.text-slate-200', 'color:' + g[800]);
  add(H + '.text-slate-300', 'color:' + g[600]);
  add(H + '.text-slate-400, ' + H + '.text-slate-500', 'color:' + g[500]);
  add(H + '.text-slate-600', 'color:' + g[400]);
  add(H + '.placeholder-slate-500::placeholder, ' + H + 'input::placeholder, ' + H + 'textarea::placeholder', 'color:' + g[400] + ' !important');

  // ---------- Acentos: esmeralda -> verde Bci, rosa -> rojo Bci, ámbar -> amarillo Bci ----------
  add(H + '.text-emerald-300, ' + H + '.text-emerald-400, ' + H + '.text-emerald-500, ' + H + '.hover\\:text-emerald-300:hover, ' + H + '.hover\\:text-emerald-600:hover', 'color:' + gr[700]);
  add(H + '.text-emerald-600, ' + H + '.text-emerald-700', 'color:' + gr[800]);
  add(H + '.text-rose-300, ' + H + '.text-rose-400, ' + H + '.text-rose-500, ' + H + '.text-rose-600, ' + H + '.hover\\:text-rose-400:hover, ' + H + '.hover\\:text-rose-500:hover, ' + H + '.hover\\:text-rose-600:hover', 'color:' + rd[500]);
  add(H + '.text-amber-400, ' + H + '.text-amber-500, ' + H + '.hover\\:text-amber-400:hover, ' + H + '.hover\\:text-amber-500:hover', 'color:' + yl[600]);
  add(H + '.text-blue-300, ' + H + '.text-blue-400, ' + H + '.text-purple-400', 'color:' + bl.primary);
  add(H + '[class*="bg-emerald-500/"], ' + H + '[class*="bg-emerald-400/"]', 'background-color:' + gr[50]);
  add(H + '[class*="bg-rose-500/"], ' + H + '.hover\\:bg-rose-50:hover', 'background-color:' + rd[50]);
  add(H + '[class*="bg-amber-500/"], ' + H + '.hover\\:bg-amber-50:hover', 'background-color:' + yl[50]);
  add(H + '[class*="border-emerald-500"], ' + H + '[class*="border-emerald-400"], ' + H + '.hover\\:border-emerald-400:hover', 'border-color:' + gr[200]);
  add(H + '[class*="border-rose-500"]', 'border-color:' + rd[200]);
  add(H + '[class*="border-amber-500"]', 'border-color:' + yl[300]);
  add(H + '.bg-emerald-400, ' + H + '.bg-emerald-500', 'background-color:' + gr[700]);
  add(H + '.hover\\:bg-emerald-400:hover, ' + H + '.hover\\:bg-emerald-500:hover', 'background-color:' + gr[600]);
  add(H + '.bg-rose-500', 'background-color:' + rd.primary);
  add(H + '.hover\\:bg-rose-400:hover', 'background-color:' + rd[400]);
  add(H + '.bg-gradient-to-r.from-emerald-500, ' + H + '.bg-gradient-to-r.from-teal-500', 'background-image:none;background-color:' + gr[700]);
  add(H + '.bg-gradient-to-r[class*="from-emerald-500/"]', 'background-image:none;background-color:' + gr[50]);
  add(H + '.shadow-lg, ' + H + '.shadow-xl, ' + H + '.shadow-2xl, ' + H + '.shadow-md', 'box-shadow:' + SH.md);

  // ---------- Componentes del JSON ----------
  var C = ds.components;
  var PRIMARY = [
    '.bg-emerald-500', '.bg-emerald-400', '.bg-gradient-to-r.from-emerald-500:not([class*="from-emerald-500/"])',
    '.bg-gradient-to-r.from-teal-500', '.bg-rose-500'
  ].map(function (s) { return H + 'button' + s + ', ' + H + 'a' + s; }).join(', ');
  var SECONDARY = [
    '[class*="bg-emerald-500/"]', '[class*="bg-gradient-to-r"][class*="from-emerald-500/"]'
  ].map(function (s) { return H + 'button' + s + ', ' + H + 'a' + s; }).join(', ');

  // Botón primario: fondo verde 700, texto blanco, forma pastilla
  add(PRIMARY, decl(C.button.primary.styles, true));
  // el confirmar-eliminar conserva rojo (acción destructiva)
  add(H + 'button.bg-rose-500', 'background-color:' + rd.primary + ' !important');
  add(H + 'button.bg-rose-500:hover', 'background-color:' + rd[600] + ' !important');
  var ps = C.button.primary.states;
  if (ps.hover) add(PRIMARY.split(', ').map(function (s) { return s + ':hover'; }).join(', '), decl(ps.hover));
  if (ps.pressed) add(PRIMARY.split(', ').map(function (s) { return s + ':active'; }).join(', '), decl(ps.pressed));
  if (ps.disabled) add(PRIMARY.split(', ').map(function (s) { return s + ':disabled'; }).join(', '), decl(ps.disabled));
  add(H + 'button.bg-rose-500:hover', 'background-color:' + rd[600] + ' !important');

  // Botón secundario: borde verde 700, fondo blanco, forma pastilla
  add(SECONDARY, decl(C.button.secondary.styles, true));
  var ss = C.button.secondary.states;
  if (ss.over) add(SECONDARY.split(', ').map(function (s) { return s + ':hover'; }).join(', '), decl(ss.over));
  if (ss.disabled) add(SECONDARY.split(', ').map(function (s) { return s + ':disabled'; }).join(', '), decl(ss.disabled));

  // Tarjeta: fondo "paper", radio md, elevación md
  var cardSel = H + '.glass-card, ' + H + '.glass-card-light';
  add(cardSel, decl(C.card.styles) + ';border:1px solid ' + g[100] + ' !important;box-shadow:' + SH[C.card.defaultProps.elevation] + ' !important;backdrop-filter:none');
  add(H + '.glass-card:hover, ' + H + '.glass-card-light:hover', 'box-shadow:' + SH.lg + ' !important');
  // borde izquierdo de color por categoría se conserva (border-l-4 inline)
  add(H + '.glass-card.border-l-4, ' + H + '.glass-card-light.border-l-4', 'border-left-width:4px !important');

  // Campo de texto: borde gris 400, fondo blanco, radio 6px, foco con aro
  var fieldSel = ['input[type="text"]', 'input[type="url"]', 'input[type="search"]', 'input:not([type])', 'select', 'textarea']
    .map(function (s) { return H + s; }).join(', ');
  add(fieldSel, decl(C.textField.styles, true));
  var fs = C.textField.states;
  if (fs.focused) add(fieldSel.split(', ').map(function (s) { return s + ':focus'; }).join(', ') + ',' + H + '.focus\\:border-emerald-500:focus', decl(fs.focused) + ';outline:none');

  // ---------- Barras de desplazamiento ----------
  add(H + '::-webkit-scrollbar-track', 'background:' + g[50]);
  add(H + '::-webkit-scrollbar-thumb', 'background:' + g[300] + ';border-radius:' + R.pill);

  // ---------- Fuente (Overpass) ----------
  var link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = 'https://fonts.googleapis.com/css2?family=Overpass:wght@300;400;500;600;700&family=Overpass+Mono&display=swap';
  document.head.appendChild(link);

  var style = document.createElement('style');
  style.id = 'ds-theme-bci';
  style.textContent = css.join('\n');
  document.head.appendChild(style);

  // ---------- Logo de la marca en el encabezado ----------
  document.addEventListener('DOMContentLoaded', function () {
    try {
      var logo = ds.branding && ds.branding.logo && ds.branding.logo.main;
      var box = document.querySelector('header .w-10.h-10.rounded-xl');
      if (!logo || !box) return;
      var img = document.createElement('img');
      img.src = logo.path;
      img.alt = logo.alt || 'Bci';
      img.style.width = logo.width || '120px';
      img.style.height = logo.height || 'auto';
      img.style.flexShrink = '0';
      img.onerror = function () { img.remove(); box.style.display = ''; };
      box.style.display = 'none';
      box.parentNode.insertBefore(img, box);
    } catch (e) { console.warn('[Tema Bci] logo', e); }
  });
})();
