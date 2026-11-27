/* Tema Bci — aplica el Sistema de Diseño BCI al Árbol de Ideas.
 *
 *   design_system_bci.json  -> tokens de marca (colores, tipografía, radios, sombras, componentes)
 *   estilos_arbol.json      -> variantes visuales del árbol, que solo REFERENCIAN tokens del sistema
 *
 * Para cambiar el diseño basta con editar esos JSON. Estilo activo: ?estilo=<id> en la URL,
 * o el último elegido con el selector inferior (se recuerda en el navegador).
 * Si los JSON no cargan, el sitio se ve con su diseño original (no se rompe nada).
 *
 * Se carga de forma síncrona en <head> para que el diseño esté listo antes del primer render.
 */
(function () {
  function loadJson(url) {
    try {
      var xhr = new XMLHttpRequest();
      xhr.open('GET', url + '?v=' + Date.now(), false);
      xhr.send(null);
      if ((xhr.status >= 200 && xhr.status < 300) || (xhr.status === 0 && xhr.responseText)) {
        return JSON.parse(xhr.responseText);
      }
    } catch (e) {
      console.warn('[Tema Bci] No se pudo cargar ' + url, e);
    }
    return null;
  }

  var dsFile = loadJson('design_system_bci.json');
  if (!dsFile) return;
  var ds = dsFile.designSystem;
  var estilosFile = loadJson('estilos_arbol.json') || { estiloPorDefecto: 'editorial', estilos: [] };

  // ---------- Selección del estilo ----------
  var STORE_KEY = 'ideasarbol_estilo';
  var wanted = null;
  try { wanted = new URLSearchParams(location.search).get('estilo'); } catch (e) {}
  if (!wanted) { try { wanted = localStorage.getItem(STORE_KEY); } catch (e) {} }
  var estilos = estilosFile.estilos || [];
  var fromUrl = false;
  try { fromUrl = !!new URLSearchParams(location.search).get('estilo'); } catch (e) {}
  var ofrecidos = estilos.filter(function (x) { return x.enTemas !== false; });
  // un estilo guardado que ya no se ofrece en Temas se ignora (por URL sí se puede abrir)
  if (!fromUrl && wanted && !ofrecidos.some(function (x) { return x.id === wanted; })) wanted = null;
  var E = estilos.filter(function (x) { return x.id === wanted; })[0] ||
          estilos.filter(function (x) { return x.id === estilosFile.estiloPorDefecto; })[0] ||
          estilos[0];
  if (!E) return;
  var LIGHT = E.modo !== 'oscuro';

  window.DESIGN_SYSTEM = ds;
  window.DS_ESTILO = E;
  window.DS_FORCE_LIGHT = LIGHT; // en modo claro, lienzo y tarjetas usan la variante clara
  var root = document.documentElement;
  root.classList.add('theme-bci', 'estilo-' + E.id, LIGHT ? 'ds-claro' : 'ds-oscuro');

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

  // Propiedades de maquetación del JSON que NO se imponen a los botones/campos existentes
  // (la app es compacta; 48px de alto o 32px de relleno romperían su distribución).
  var LAYOUT = /^(display|height|width|padding|justifyContent|alignItems|alignSelf|flexShrink|flex|flexDirection|gap|textAlign|position|left|top|fontSize|lineHeight)$/;
  function decl(styles, skipLayout) {
    return Object.keys(styles).filter(function (k) { return !(skipLayout && LAYOUT.test(k)); })
      .map(function (k) { return kebab(k) + ':' + res(styles[k]) + ' !important'; }).join(';');
  }

  var P = ds.colors.palette;
  var T = ds.typography;
  var R = ds.borderRadius;
  var SH = ds.shadows;
  var C = ds.components;
  var font = '"' + T.fontFamily.main + '", system-ui, -apple-system, "Segoe UI", sans-serif';
  var H = 'html.theme-bci ';
  var g = P.gray, gr = P.green, rd = P.red, yl = P.yellow, bl = P.blue;

  // ---------- Colores del estilo ----------
  var cat = {};
  ['metrics', 'spontaneous', 'pain', 'bank'].forEach(function (k) {
    var c = (E.categorias || {})[k] || {};
    cat[k] = { linea: res(c.linea), texto: res(c.texto || c.linea) };
  });
  var lienzo = { fondo: res(E.lienzo.fondo), luz: res(E.lienzo.luz), malla: res(E.lienzo.malla) };
  var tronco = res(E.tronco);
  var tinta = res(E.tinta || E.tronco);

  // Colores "de fábrica" de la app (Tailwind) -> categoría. Se usan para recolorear lo ya dibujado
  // sin modificar los datos guardados en la nube.
  var GRUPOS = {
    metrics: ['#3b82f6', '#0ea5e9', '#60a5fa'],
    spontaneous: ['#10b981', '#14b8a6', '#2dd4bf', '#34d399'],
    pain: ['#f43f5e', '#fb7185'],
    bank: ['#8b5cf6', '#a78bfa']
  };
  var map = {};
  Object.keys(GRUPOS).forEach(function (k) { GRUPOS[k].forEach(function (h) { map[h] = cat[k].linea; }); });
  map['#64748b'] = LIGHT ? g[500] : bl[300]; // estado "Nueva"
  window.DS_COLOR_MAP = map;
  // Color de texto legible para cada color de línea (clave: color ya mapeado o color de fábrica)
  var tmap = {};
  Object.keys(GRUPOS).forEach(function (k) {
    tmap[cat[k].linea.toLowerCase()] = cat[k].texto;
    GRUPOS[k].forEach(function (h) { tmap[h] = cat[k].texto; });
  });
  tmap[String(map['#64748b']).toLowerCase()] = LIGHT ? g[700] : bl[200];
  tmap['#64748b'] = LIGHT ? g[700] : bl[200];
  window.DS_TEXT_MAP = tmap;

  var css = [];
  var add = function (sel, body) { css.push(sel + '{' + body + '}'); };
  var list = function (arr) { return arr.join(', '); };
  var mix = function (color, pct) {
    return LIGHT ? 'color-mix(in srgb,' + color + ' ' + pct + '%,#fff)' : 'color-mix(in srgb,' + color + ' ' + (pct + 10) + '%,transparent)';
  };

  // ---------- Variables CSS ----------
  var vars = [];
  Object.keys(P).forEach(function (hue) {
    Object.keys(P[hue]).forEach(function (k) { vars.push('--ds-' + hue + '-' + k + ':' + P[hue][k]); });
  });
  vars.push('--ds-font:' + font);
  Object.keys(R).forEach(function (k) { vars.push('--ds-radius-' + kebab(k) + ':' + R[k]); });
  Object.keys(SH).forEach(function (k) { vars.push('--ds-shadow-' + k + ':' + SH[k]); });
  add('html.theme-bci', vars.join(';'));

  // ---------- Base: tipografía y legibilidad ----------
  var ink = LIGHT ? g[900] : P.white.main;
  add(H + 'body', 'background-color:' + lienzo.fondo + ' !important;color:' + ink + ';font-family:' + font);
  add('html.theme-bci.h-full', 'background-color:' + lienzo.fondo + ';color:' + ink);
  add(H + '.font-sans, ' + H + 'button, ' + H + 'input, ' + H + 'select, ' + H + 'textarea', 'font-family:' + font + ' !important');
  add(H + '#customBgOverlay', 'display:none');
  // Textos diminutos: +1/+2 px para que se lean con comodidad
  add(H + '.text-\\[8px\\]', 'font-size:10px !important');
  add(H + '.text-\\[9px\\]', 'font-size:10.5px !important');
  add(H + '.text-\\[10px\\]', 'font-size:11px !important');
  add(H + '.text-\\[11px\\]', 'font-size:12px !important');

  // Encabezado compacto con logo de 120px
  add(H + 'header h1, ' + H + 'header h1 span, ' + H + '#activeTreeSub, ' + H + 'header .xl\\:flex > div, ' + H + '#treePickerDropdownBtn', 'white-space:nowrap');
  add(H + 'header', 'padding-left:1rem;padding-right:1rem;gap:.75rem');
  add(H + 'header .xl\\:flex', 'gap:.5rem');
  add(H + 'header .xl\\:flex > div', 'padding-left:.6rem;padding-right:.6rem');
  add(H + 'header .xl\\:flex > div, ' + H + 'header .flex.items-center.gap-2 > button', 'flex-shrink:0');

  // Franja con los colores del logo
  if (E.franjaLogo && E.franjaLogo.length) {
    var cols = E.franjaLogo.map(res), seg = 100 / cols.length;
    var stops = cols.map(function (c, i) { return c + ' ' + (i * seg) + '% ' + ((i + 1) * seg) + '%'; }).join(',');
    add(H + 'header::after', 'content:"";position:absolute;left:0;right:0;top:0;height:4px;background:linear-gradient(90deg,' + stops + ');pointer-events:none');
  }

  // =====================================================================
  //  MODO CLARO
  // =====================================================================
  if (LIGHT) {
    add(H + '.dot-grid', 'background-image:radial-gradient(' + lienzo.malla + ' 1px,transparent 1px)');
    add(H + '#canvasContainer.canvas-light-theme',
      'background-color:' + lienzo.fondo + ';background-image:radial-gradient(circle at 50% 38%,' + lienzo.luz + ' 0%,rgba(255,255,255,0) 66%),radial-gradient(' + lienzo.malla + ' 1px,transparent 1px);background-size:100% 100%,24px 24px');

    add(H + '.glass-panel, ' + H + '.glass-panel-light',
      'background:' + P.white.main + ' !important;backdrop-filter:none;border:1px solid ' + g[100] + ' !important;box-shadow:' + SH.sm);
    add(H + 'header.glass-panel', 'border-top:0 !important;border-left:0 !important;border-right:0 !important;border-bottom:1px solid ' + g[100] + ' !important');

    // Fondos
    add(list([H + '.bg-slate-950', H + '.bg-slate-900', H + '[class*="bg-slate-900/"]']), 'background-color:' + P.white.main);
    add(list([H + '.bg-slate-800', H + '[class*="bg-slate-800/"]', H + '.bg-slate-100']), 'background-color:' + g[50]);
    add(list([H + '.bg-slate-700', H + '.hover\\:bg-slate-800:hover', H + '.hover\\:bg-slate-700:hover']), 'background-color:' + g[100]);
    add(H + '.bg-slate-950\\/97', 'background-color:rgba(255,255,255,.97)');
    add(list([H + '.bg-slate-950\\/85', H + '.bg-slate-950\\/80']), 'background-color:rgba(20,27,31,.45)');
    add(list([H + '.bg-slate-950\\/60', H + '.bg-slate-950\\/70']), 'background-color:' + g[50]);
    add(list([H + '.bg-emerald-950', H + '[class*="bg-emerald-950/"]']), 'background-color:' + gr[50]);
    add(H + '.bg-purple-950', 'background-color:' + bl[50]);
    // Bordes
    add(list([H + '.border-slate-800', H + '[class*="border-slate-800/"]']), 'border-color:' + g[100]);
    add(list([H + '.border-slate-700', H + '[class*="border-slate-700/"]', H + '[class*="border-slate-500/"]']), 'border-color:' + g[200]);
    // Texto: escala de contraste alto (AA) sobre blanco
    add(list([H + '.text-white', H + '.text-slate-100', H + '.hover\\:text-white:hover']), 'color:' + g[900]);
    add(H + '.text-slate-200', 'color:' + g[800]);
    add(H + '.text-slate-300', 'color:' + g[700]);
    add(list([H + '.text-slate-400', H + '.text-slate-500']), 'color:' + g[600]);
    add(H + '.text-slate-600', 'color:' + g[600]);
    add(list([H + '.glass-panel .text-slate-300', H + '.glass-panel .text-slate-400']), 'color:' + g[600] + ' !important');
    add(list([H + '.placeholder-slate-500::placeholder', H + 'input::placeholder', H + 'textarea::placeholder']), 'color:' + g[500] + ' !important');
    add(list([H + '::-webkit-scrollbar-track']), 'background:' + g[50]);
    add(H + '::-webkit-scrollbar-thumb', 'background:' + g[300] + ';border-radius:' + R.pill);
  }

  // =====================================================================
  //  MODO OSCURO (azul profundo de la marca)
  // =====================================================================
  if (!LIGHT) {
    add(H + '#canvasContainer:not(.canvas-light-theme)',
      'background-color:' + lienzo.fondo + ';background-image:radial-gradient(circle at 50% 42%,' + lienzo.luz + ' 0%,' + lienzo.fondo + ' 72%)');
    add(H + '.dot-grid', 'background-image:radial-gradient(' + bl[700] + '55 1px,transparent 1px)');
    add(H + '.glass-panel',
      'background:' + bl[900] + ' !important;backdrop-filter:none;border:1px solid ' + bl[800] + ' !important;box-shadow:' + SH.md);
    add(H + 'header.glass-panel', 'border-top:0 !important;border-left:0 !important;border-right:0 !important;border-bottom:1px solid ' + bl[800] + ' !important');

    add(list([H + '.bg-slate-950', H + '.bg-slate-900', H + '[class*="bg-slate-900/"]']), 'background-color:' + bl[900]);
    add(list([H + '.bg-slate-800', H + '[class*="bg-slate-800/"]']), 'background-color:' + bl[800]);
    add(list([H + '.bg-slate-700', H + '.hover\\:bg-slate-800:hover', H + '.hover\\:bg-slate-700:hover']), 'background-color:' + bl[700]);
    add(H + '.bg-slate-950\\/97', 'background-color:rgba(0,18,41,.97)');
    add(list([H + '.bg-slate-950\\/85', H + '.bg-slate-950\\/80']), 'background-color:rgba(0,18,41,.72)');
    add(list([H + '.bg-slate-950\\/60', H + '.bg-slate-950\\/70']), 'background-color:' + bl[800]);
    add(list([H + '.border-slate-800', H + '[class*="border-slate-800/"]']), 'border-color:' + bl[800]);
    add(list([H + '.border-slate-700', H + '[class*="border-slate-700/"]', H + '[class*="border-slate-500/"]']), 'border-color:' + bl[700]);
    add(list([H + '.text-white', H + '.text-slate-100']), 'color:' + P.white.main);
    add(H + '.text-slate-200', 'color:' + bl[50]);
    add(H + '.text-slate-300', 'color:' + bl[100]);
    add(H + '.text-slate-400', 'color:' + bl[200]);
    add(H + '.text-slate-500', 'color:' + bl[300]);
    add(H + '.text-slate-600', 'color:' + bl[400]);
    add(list([H + 'input::placeholder', H + 'textarea::placeholder']), 'color:' + g[500] + ' !important');
    add(H + '::-webkit-scrollbar-track', 'background:' + bl[900]);
    add(H + '::-webkit-scrollbar-thumb', 'background:' + bl[700] + ';border-radius:' + R.pill);
  }

  // =====================================================================
  //  Categorías: chips, íconos y textos según el color de cada categoría
  // =====================================================================
  var FAM = { metrics: 'blue', spontaneous: 'emerald', pain: 'rose', bank: 'purple' };
  Object.keys(FAM).forEach(function (k) {
    var f = FAM[k], c = cat[k];
    add(list([H + '.bg-' + f + '-500\\/10', H + '.bg-' + f + '-500\\/15', H + '.bg-' + f + '-500\\/20', H + '.bg-' + f + '-500\\/30']), 'background-color:' + mix(c.linea, 14));
    add(list([H + '.text-' + f + '-300', H + '.text-' + f + '-400', H + '.text-' + f + '-500', H + '.text-' + f + '-600', H + '.text-' + f + '-700']), 'color:' + c.texto);
    add(list([H + '[class*="border-' + f + '-500"]', H + '[class*="border-' + f + '-400"]']), 'border-color:' + mix(c.linea, 38));
  });
  // Acentos de interfaz que no son categoría
  add(list([H + '.hover\\:text-emerald-300:hover', H + '.hover\\:text-emerald-600:hover']), 'color:' + (LIGHT ? gr[800] : gr[300]));
  add(list([H + '.hover\\:text-rose-400:hover', H + '.hover\\:text-rose-500:hover', H + '.hover\\:text-rose-600:hover']), 'color:' + (LIGHT ? rd[600] : rd[300]));
  add(list([H + '.text-amber-400', H + '.text-amber-500', H + '.hover\\:text-amber-400:hover', H + '.hover\\:text-amber-500:hover']), 'color:' + (LIGHT ? yl[700] : yl[400]));
  add(list([H + '[class*="bg-amber-500/"]', H + '.hover\\:bg-amber-50:hover']), 'background-color:' + mix(yl[500], 18));
  add(H + '[class*="border-amber-500"]', 'border-color:' + mix(yl[500], 45));
  add(H + '.hover\\:bg-rose-50:hover', 'background-color:' + rd[50]);
  add(list([H + '.bg-emerald-400', H + '.bg-emerald-500']), 'background-color:' + gr[700]);
  add(list([H + '.hover\\:bg-emerald-400:hover', H + '.hover\\:bg-emerald-500:hover']), 'background-color:' + gr[600]);
  add(H + '.bg-rose-500', 'background-color:' + rd.primary);
  add(H + '.hover\\:bg-rose-400:hover', 'background-color:' + rd[400]);
  add(list([H + '.bg-gradient-to-r.from-emerald-500', H + '.bg-gradient-to-r.from-teal-500']), 'background-image:none;background-color:' + gr[700]);
  add(H + '.bg-gradient-to-r[class*="from-emerald-500/"]', 'background-image:none;background-color:' + mix(cat.spontaneous.linea, 14));
  add(list([H + '.shadow-lg', H + '.shadow-xl', H + '.shadow-2xl', H + '.shadow-md']), 'box-shadow:' + SH.md);

  // ---------- Componentes del JSON ----------
  var PRIMARY = ['.bg-emerald-500', '.bg-emerald-400', '.bg-gradient-to-r.from-emerald-500:not([class*="from-emerald-500/"])', '.bg-gradient-to-r.from-teal-500', '.bg-rose-500']
    .map(function (s) { return H + 'button' + s + ', ' + H + 'a' + s; }).join(', ');
  var SECONDARY = ['[class*="bg-emerald-500/"]:not(.tree-option-btn)', '[class*="bg-gradient-to-r"][class*="from-emerald-500/"]']
    .map(function (s) { return H + 'button' + s + ', ' + H + 'a' + s; }).join(', ');
  var states = function (sel, st) { return sel.split(', ').map(function (s) { return s + st; }).join(', '); };

  add(PRIMARY, decl(C.button.primary.styles, true));
  var ps = C.button.primary.states;
  if (ps.hover) add(states(PRIMARY, ':hover'), decl(ps.hover));
  if (ps.pressed) add(states(PRIMARY, ':active'), decl(ps.pressed));
  if (ps.disabled) add(states(PRIMARY, ':disabled'), decl(ps.disabled));
  add(H + 'button.bg-rose-500', 'background-color:' + rd.primary + ' !important');
  add(H + 'button.bg-rose-500:hover', 'background-color:' + rd[600] + ' !important');

  add(SECONDARY, decl(C.button.secondary.styles, true));
  var ss = C.button.secondary.states;
  if (ss.over) add(states(SECONDARY, ':hover'), decl(ss.over));
  if (ss.disabled) add(states(SECONDARY, ':disabled'), decl(ss.disabled));

  // Tarjeta: radio y sombra del estilo (sin halos de color)
  var cardR = res(E.tarjeta && E.tarjeta.radio ? E.tarjeta.radio : '{borderRadius.md}');
  var cardSh = SH[(E.tarjeta && E.tarjeta.sombra) || C.card.defaultProps.elevation];
  var cardSel = H + '.glass-card, ' + H + '.glass-card-light';
  if (LIGHT) {
    add(cardSel, 'background-color:' + res(C.card.styles.backgroundColor) + ' !important;border:1px solid ' + g[100] + ' !important;border-radius:' + cardR + ' !important;box-shadow:' + cardSh + ' !important;backdrop-filter:none');
    add(list([H + '.glass-card:hover', H + '.glass-card-light:hover']), 'box-shadow:' + SH.lg + ' !important');
  } else {
    add(cardSel, 'background-color:' + bl[800] + ' !important;border:1px solid ' + bl[700] + ' !important;border-radius:' + cardR + ' !important;box-shadow:' + cardSh + ' !important;backdrop-filter:none');
    add(list([H + '.glass-card:hover']), 'box-shadow:0 12px 24px rgba(0,0,0,.45) !important;background-color:' + bl[700] + ' !important');
  }
  add(list([H + '.glass-card.border-l-4', H + '.glass-card-light.border-l-4']), 'border-left-width:4px !important');

  // Campo de texto
  var fieldSel = ['input[type="text"]', 'input[type="url"]', 'input[type="search"]', 'input:not([type])', 'select', 'textarea']
    .map(function (s) { return H + s; }).join(', ');
  add(fieldSel, decl(C.textField.styles, true));
  var fs = C.textField.states;
  if (fs.focused) add(states(fieldSel, ':focus') + ',' + H + '.focus\\:border-emerald-500:focus', decl(fs.focused) + ';outline:none');

  // ---------- Listas desplegables: flecha propia en vez de la nativa del sistema ----------
  var chev = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="' + g[600] + '" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3.5,6 8,10.5 12.5,6"/></svg>';
  add(H + 'select', 'appearance:none;-webkit-appearance:none;-moz-appearance:none;cursor:pointer;' +
    'background-image:url("data:image/svg+xml;utf8,' + encodeURIComponent(chev) + '") !important;background-repeat:no-repeat !important;background-position:right 10px center !important;background-size:14px !important;padding-right:32px !important');
  add(H + 'select option', 'color:' + g[900] + ';background:#fff');

  // ---------- Deslizador de zoom ----------
  add(H + '.zoom-slider::-webkit-slider-runnable-track', 'background:' + (LIGHT ? g[200] : bl[700]));
  add(H + '.zoom-slider::-moz-range-track', 'background:' + (LIGHT ? g[200] : bl[700]));
  add(H + '.zoom-slider::-webkit-slider-thumb', 'background:' + gr[700] + ';border-color:' + (LIGHT ? '#fff' : bl[900]));
  add(H + '.zoom-slider::-moz-range-thumb', 'background:' + gr[700] + ';border-color:' + (LIGHT ? '#fff' : bl[900]));

  // ---------- Editor de categorías (Ajustes > Categorías) ----------
  add(H + '.cat-card', '--cat-bg:' + (LIGHT ? '#fff' : bl[900]));
  add(H + '.cat-label, ' + H + '.cat-count', 'color:' + (LIGHT ? g[600] : bl[200]));
  add(H + '.cat-count.is-long', 'color:' + (LIGHT ? yl[700] : yl[400]));
  add(H + '.cat-chev', 'background:' + (LIGHT ? g[100] : bl[700]) + ';color:' + (LIGHT ? g[700] : bl[50]));
  add(H + '.cat-link', 'color:' + (LIGHT ? gr[700] : gr[300]));
  add(H + '.cat-icon-grid', 'background:' + (LIGHT ? g[50] : bl[800]) + ';border:1px solid ' + (LIGHT ? g[100] : bl[700]));
  add(H + '.cat-icon-opt', 'color:' + (LIGHT ? g[700] : bl[100]));
  add(H + '.cat-icon-opt:hover', 'background:' + (LIGHT ? g[100] : bl[700]));
  add(H + '.cat-icon-opt.is-selected', 'background:var(--sw);color:var(--sw-ink,#fff)');
  add(H + 'input.cat-title-input', 'color:' + g[900] + ' !important;font-size:15px');
  add(H + 'textarea.cat-desc-input', 'color:' + g[700] + ' !important;line-height:1.45');
  add(H + '.cat-card .cat-del', 'border-radius:' + R.pill);

  // =====================================================================
  //  Dibujo del árbol (SVG)
  // =====================================================================
  var S = H + '#treeSvg ';
  // Sin brillos difuminados en modo claro (se ven sucios sobre blanco)
  if (LIGHT) {
    add(S + '[filter], ' + S + '#dynamicSubBranches, ' + S + '#branchConnectors [filter]', 'filter:none !important');
    add(S + '.leaf-pulse', 'animation:none !important');
    add(S + 'path[d="M 700 800 L 700 380"]', 'display:none');
  }
  // Aves: silueta de perfil con alas que aletean desde el hombro
  // Mismo aleteo que las aves originales: 0,28 s, de reposo a 50° y de vuelta
  add(H + '#animatedBirdsLayer .ds-wing', 'transform-origin:3px -2px;animation:dsFlap .28s infinite ease-in-out');
  add(H + '#animatedBirdsLayer .ds-wing-far', 'transform-origin:3px -2px;animation:dsFlap .28s infinite ease-in-out;animation-delay:-.06s');
  css.push('@keyframes dsFlap{0%,100%{transform:rotate(0deg)}50%{transform:rotate(-50deg)}}');
  // Tronco
  add(S + 'path[fill="url(#trunkGrad)"]', 'fill:' + tronco + ';stroke:' + tronco);
  add(S + 'path[stroke="#1e293b"]', 'stroke:' + tronco);
  // Ramas y nodos por categoría
  Object.keys(GRUPOS).forEach(function (k) {
    var c = cat[k].linea;
    GRUPOS[k].forEach(function (h) {
      if (E.ramas === 'tinta') {
        add(S + 'g[stroke] > path[stroke="' + h + '"]', 'stroke:' + tinta);
      } else {
        add(S + 'path[stroke="' + h + '"]', 'stroke:' + c);
      }
      if (E.nodos === 'anillo') {
        add(S + '#leafAnchors circle[fill="' + h + '"]', 'fill:' + (LIGHT ? '#fff' : lienzo.fondo) + ';stroke:' + c + ';stroke-width:4');
      } else {
        add(S + '#leafAnchors circle[fill="' + h + '"]', 'fill:' + c + ';stroke:' + (LIGHT ? '#fff' : lienzo.fondo) + ';stroke-width:3');
      }
    });
  });
  // Copa / follaje
  if (E.follaje === 'oculto') {
    add(S + '#treeFoliageCanopy', 'display:none');
  } else if (E.follaje === 'plano') {
    var fc = E.follajeColores || {};
    [['Emerald', 'emerald'], ['Blue', 'blue'], ['Violet', 'violet'], ['Rose', 'rose']].forEach(function (p) {
      if (fc[p[1]]) add(S + '[fill="url(#foliage' + p[0] + ')"]', 'fill:' + res(fc[p[1]]) + ';opacity:.9');
    });
  } else if (E.follaje === 'suave') {
    add(S + '#treeFoliageCanopy', 'opacity:.55');
  }
  // Tarjetas fuera de color en el selector de colores: sin cambios

  // =====================================================================
  //  Estilo "Sitio Bci": lenguaje visual de bci.cl
  // =====================================================================
  var SITIO = E.referencia === 'bci.cl';
  var motivoUrl = '';
  if (SITIO) {
    var svgMotivo = '<svg xmlns="http://www.w3.org/2000/svg" width="72" height="18" viewBox="0 0 56 14">' +
      '<rect x="0" y="1" width="12" height="12" fill="' + rd.primary + '"/>' +
      '<circle cx="21" cy="7" r="6" fill="' + gr.primary + '"/>' +
      '<polygon points="28,13 34,1 40,13" fill="' + yl.primary + '"/>' +
      '<rect x="43" y="2" width="13" height="10" fill="' + bl.dark + '"/></svg>';
    motivoUrl = 'url("data:image/svg+xml;utf8,' + encodeURIComponent(svgMotivo) + '")';
    var panel = res(E.panelLateral || '{colors.palette.gray.50}');
    var B = H.replace('html.theme-bci ', 'html.estilo-sitio-bci ') + ''; // prefijo más específico
    B = 'html.theme-bci.estilo-sitio-bci ';

    // Barra lateral: sección gris 50, titular en frase con la fila de figuras
    add(B + 'aside#sidebar', 'background:' + panel + ' !important;border-right:1px solid ' + g[100] + ' !important;box-shadow:none');
    add(B + '#sidebar h2', 'font-size:18px;line-height:24px;font-weight:600;text-transform:none;letter-spacing:0;color:' + g[700]);
    add(B + '#sidebar h2::before', 'content:"";display:block;width:72px;height:18px;margin-bottom:10px;background:' + motivoUrl + ' no-repeat left center');
    add(B + '#sidebar h2 + p', 'font-size:13px;line-height:20px;color:' + g[600]);
    add(B + '#sidebar .text-xs.font-semibold.text-slate-400', 'color:' + g[700] + ';font-size:12px');
    // Tarjetas de categoría: ícono en círculo pastel, como las "herramientas" del sitio
    add(B + '.sidebar-preset-card', 'background:' + P.white.main + ' !important;box-shadow:' + SH.sm + ' !important;border-radius:' + R.md + ' !important');
    add(B + '.sidebar-preset-card .w-7.h-7', 'width:38px;height:38px;border-radius:' + R.pill + ';font-size:15px');
    add(B + '.sidebar-preset-card .text-sm', 'font-size:15px;font-weight:600');

    // Encabezado: botones en píldora. Compartir = verde sólido, Top = azul sólido, resto = contorno suave
    var hb = B + 'header #shareTreeUrlBtn, ' + B + 'header #toggleLeaderboardBtn, ' + B + 'header #openConfigBtn, ' + B + 'header #toggleMatrixBtn, ' + B + 'header #toggleTrendsBtn, ' + B + 'header #resetDemoBtn, ' + B + 'header #exportCsvBtn';
    add(hb, 'border-radius:' + R.pill + ' !important;font-weight:600');
    add(B + 'header #shareTreeUrlBtn', 'background:' + gr[700] + ' !important;color:#fff !important;border:2px solid ' + gr[700] + ' !important;text-transform:uppercase;letter-spacing:.05em');
    add(B + 'header #shareTreeUrlBtn *', 'color:#fff !important');
    add(B + 'header #shareTreeUrlBtn:hover', 'background:' + gr[600] + ' !important;border-color:' + gr[600] + ' !important');
    add(B + 'header #toggleLeaderboardBtn', 'background:' + bl[600] + ' !important;color:#fff !important;border:2px solid ' + bl[600] + ' !important;text-transform:uppercase;letter-spacing:.05em');
    add(B + 'header #toggleLeaderboardBtn *', 'color:#fff !important');
    add(B + 'header #toggleLeaderboardBtn:hover', 'background:' + bl[700] + ' !important;border-color:' + bl[700] + ' !important');
    add(list([B + 'header #openConfigBtn', B + 'header #toggleMatrixBtn', B + 'header #toggleTrendsBtn', B + 'header #resetDemoBtn', B + 'header #exportCsvBtn']),
      'background:' + P.white.main + ' !important;border:1px solid ' + g[200] + ' !important;color:' + g[700] + ' !important');
    add(list([B + 'header #openConfigBtn:hover', B + 'header #toggleMatrixBtn:hover', B + 'header #toggleTrendsBtn:hover', B + 'header #resetDemoBtn:hover', B + 'header #exportCsvBtn:hover']),
      'background:' + g[50] + ' !important;border-color:' + g[400] + ' !important');

    // Botones de los diálogos: mayúsculas con espaciado, como en el sitio
    add(list([B + '#ideaModal button[type="submit"]', B + '#saveConfigChangesBtn', B + '#saveNewTreeBtn', B + '#applyBgUrlBtn', B + '#confirmDeleteConfirmBtn']),
      'text-transform:uppercase;letter-spacing:.05em');
    // Enlaces de las tarjetas: azul en mayúsculas pequeñas
    add(list([B + 'button[onclick^="toggleCardDescription"]']), 'color:' + bl[600] + ' !important;text-transform:uppercase;letter-spacing:.05em;font-weight:700');
    add(list([B + '#configModal h3::before', B + '#priorityMatrixView h2::before']), 'content:"";display:block;width:72px;height:18px;margin-bottom:8px;background:' + motivoUrl + ' no-repeat left center');

    // Barra superior oscura con los árboles como pestañas
    var strip = res(E.franjaSuperior || '{colors.palette.gray.700}');
    add(B + '#dsTopStrip', 'display:flex;align-items:stretch;gap:0;height:36px;flex-shrink:0;background:' + strip + ';overflow-x:auto;overflow-y:hidden;white-space:nowrap;scrollbar-width:none;z-index:31');
    add(B + '#dsTopStrip::-webkit-scrollbar', 'display:none');
    add(B + '#dsTopStrip button', 'all:unset;box-sizing:border-box;cursor:pointer;padding:0 16px;display:flex;align-items:center;font-family:' + font + ';font-size:12px;font-weight:500;letter-spacing:.05em;text-transform:uppercase;color:' + g[100] + ';transition:background .15s');
    add(B + '#dsTopStrip button:hover', 'background:' + g[600]);
    add(B + '#dsTopStrip button[aria-current="true"]', 'background:' + g[50] + ';color:' + g[800] + ';font-weight:600');
    add(B + '#dsTopStrip .ds-stats', 'margin-left:auto;display:flex !important;align-items:center;gap:18px;padding-right:16px;font-size:12px;letter-spacing:.04em;text-transform:uppercase;white-space:nowrap');
    add(B + '#dsTopStrip .ds-stats > div', 'background:transparent !important;border:0 !important;padding:0 !important;gap:6px !important;color:' + g[100] + ' !important');
    add(B + '#dsTopStrip .ds-stats span, ' + B + '#dsTopStrip .ds-stats strong', 'color:' + g[100] + ' !important');
    add(B + '#dsTopStrip .ds-stats strong', 'color:#fff !important;font-weight:700');
    add(B + '#dsTopStrip .ds-stats i', 'font-size:12px');
    add(B + '#dsTopStrip button:focus-visible', 'outline:2px solid ' + yl[500] + ';outline-offset:-2px');
  }

  // ---------- Fuente ----------
  var link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = 'https://fonts.googleapis.com/css2?family=Overpass:wght@300;400;500;600;700&family=Overpass+Mono&display=swap';
  document.head.appendChild(link);

  var style = document.createElement('style');
  style.id = 'ds-theme-bci';
  style.textContent = css.join('\n');
  document.head.appendChild(style);

  // ---------- Logo + selector de estilo ----------
  document.addEventListener('DOMContentLoaded', function () {
    try {
      var logo = ds.branding && ds.branding.logo && ds.branding.logo.main;
      var box = document.querySelector('header .w-10.h-10.rounded-xl');
      if (logo && box) {
        var img = document.createElement('img');
        img.src = logo.path;
        img.alt = logo.alt || 'Bci';
        img.style.width = logo.width || '120px';
        img.style.height = logo.height || 'auto';
        img.style.flexShrink = '0';
        if (!LIGHT) { // el logo es de trazo negro: sobre azul oscuro va en una placa blanca
          img.style.background = '#fff';
          img.style.padding = '4px 8px';
          img.style.borderRadius = R.md;
          img.style.width = '104px';
        }
        img.onerror = function () { img.remove(); box.style.display = ''; };
        box.style.display = 'none';
        box.parentNode.insertBefore(img, box);
      }
    } catch (e) { console.warn('[Tema Bci] logo', e); }

    if (SITIO) {
      try {
        var body = document.body, hdr = document.querySelector('header');
        var bar0 = document.createElement('nav');
        bar0.id = 'dsTopStrip';
        bar0.setAttribute('aria-label', 'Árboles de ideas');
        body.insertBefore(bar0, hdr);
        var refreshStrip = function () {
          try {
            if (typeof trees === 'undefined' || !trees.length) return;
            var sig = trees.map(function (t) { return t.id + ':' + t.name; }).join('|') + '#' + currentTreeId;
            if (bar0.getAttribute('data-sig') === sig) return;
            bar0.setAttribute('data-sig', sig);
            [].slice.call(bar0.querySelectorAll(':scope > button')).forEach(function (n) { n.remove(); });
            var statsEl = bar0.querySelector('.ds-stats');
            trees.forEach(function (t) {
              var b = document.createElement('button');
              b.type = 'button';
              b.textContent = t.name.replace(/^Árbol\s+/i, '');
              b.title = t.name + (t.team ? ' · ' + t.team : '');
              if (t.id === currentTreeId) b.setAttribute('aria-current', 'true');
              b.onclick = function () { if (window.switchActiveTree) window.switchActiveTree(t.id); };
              bar0.insertBefore(b, statsEl);
            });
          } catch (e) {}
        };
        // El árbol activo y la lista cambian cuando la app redibuja el selector del encabezado
        var obs = new MutationObserver(refreshStrip);
        ['pickerActiveTreeName', 'treePickerMenuOptions'].forEach(function (id) {
          var n = document.getElementById(id);
          if (n) obs.observe(n, { childList: true, characterData: true, subtree: true });
        });
        var stats = document.querySelector('header .xl\\:flex');
        if (stats) { stats.classList.add('ds-stats'); bar0.appendChild(stats); }
        refreshStrip();
        setTimeout(refreshStrip, 600);
      } catch (e) { console.warn('[Tema Bci] barra superior', e); }
    }

    // ---------- Aves del árbol: silueta de perfil, planas y con colores del sistema ----------
    try {
      var birds = document.querySelectorAll('#animatedBirdsLayer > g');
      var palette = [cat.metrics.linea, cat.pain.linea, cat.bank.linea, cat.spontaneous.linea, LIGHT ? bl.dark : bl[200]];
      var dark = function (c) { return 'color-mix(in srgb,' + c + ' 78%,#141B1F)'; };
      var beakFor = function (c) { return c === yl[500] || c === yl[600] || c === yl[400] ? g[700] : yl[500]; };
      [].slice.call(birds).forEach(function (b, i) {
        var c = palette[i % palette.length], w = dark(c), beak = beakFor(c);
        var svg = '<g>' +
          '<path class="ds-wing-far" d="M 3 -2 Q -3 -15 -15 -19 Q -9 -8 -7 -1 Z" fill="' + w + '" opacity=".55"/>' +
          '<polygon points="-9,0 -21,-4 -21,3" fill="' + w + '"/>' +
          '<ellipse cx="0" cy="0" rx="11" ry="4.6" fill="' + c + '"/>' +
          '<circle cx="11" cy="-2" r="3.7" fill="' + c + '"/>' +
          '<polygon points="14,-3 20,-1.4 14,-0.2" fill="' + beak + '"/>' +
          '<circle cx="12.2" cy="-2.7" r="1" fill="#fff"/><circle cx="12.5" cy="-2.7" r=".5" fill="#141B1F"/>' +
          '<path class="ds-wing" d="M 3 -2 Q -4 -17 -18 -21 Q -11 -9 -8 -0.5 Z" fill="' + w + '"/>' +
          '</g>';
        b.innerHTML = svg;
      });
      window.DS_BIRD = { colors: palette, dark: dark, beak: beakFor, ink: g[700] };
    } catch (e) { console.warn('[Tema Bci] aves', e); }

    // ---------- Panel Ajustes > Temas: los estilos del sistema de diseño ----------
    try {
      var modal = document.getElementById('configModal');
      var lblEl = modal && [].slice.call(modal.querySelectorAll('label')).filter(function (l) { return /Temas y Colores/i.test(l.textContent); })[0];
      if (!lblEl) return;
      lblEl.textContent = 'Temas y estilos';
      var head = lblEl.parentElement;
      var grid = head.nextElementSibling;
      var resetBtn = head.querySelector('button');
      var cardBorder = LIGHT ? g[200] : bl[700], cardInk = LIGHT ? g[900] : P.white.main, cardSub = LIGHT ? g[600] : bl[200];

      var pick = function (id) {
        try { localStorage.setItem(STORE_KEY, id); } catch (e) {}
        var u = new URL(location.href);
        u.searchParams.delete('estilo');
        location.href = u.toString();
      };

      // Miniatura generada con los mismos tokens de cada estilo
      var mini = function (st) {
        var c = function (v) { return res(v); };
        var cats = st.categorias || {};
        var col = function (k) { return c((cats[k] || {}).linea || '{colors.palette.gray.500}'); };
        var ink = st.ramas === 'tinta' ? c(st.tinta || st.tronco) : null;
        var dark = st.modo === 'oscuro';
        var bg = c(st.lienzo.fondo);
        var sv = '<svg viewBox="0 0 160 70" width="100%" height="70" xmlns="http://www.w3.org/2000/svg" style="display:block;border-radius:8px">' +
          '<rect width="160" height="70" fill="' + bg + '"/>';
        if (st.referencia === 'bci.cl') {
          sv += '<rect width="160" height="9" fill="' + c(st.franjaSuperior) + '"/><rect x="0" y="9" width="30" height="61" fill="' + c(st.panelLateral) + '"/>' +
            '<rect x="6" y="16" width="5" height="5" fill="' + rd.primary + '"/><circle cx="16" cy="18.5" r="2.5" fill="' + gr.primary + '"/><rect x="21" y="16" width="5" height="5" fill="' + bl.dark + '"/>';
        } else {
          sv += '<rect width="30" height="70" fill="' + (dark ? bl[800] : c(st.lienzo.luz)) + '" opacity="' + (dark ? '1' : '.7') + '"/>';
        }
        if (st.follaje === 'plano' && st.follajeColores) {
          sv += '<circle cx="62" cy="26" r="13" fill="' + c(st.follajeColores.blue) + '"/><circle cx="105" cy="22" r="14" fill="' + c(st.follajeColores.emerald) + '"/><circle cx="140" cy="30" r="12" fill="' + c(st.follajeColores.rose) + '"/>';
        }
        var tr = c(st.tronco);
        var br = [['M95 62 C80 50 66 38 58 28', 'metrics'], ['M95 62 C95 46 96 34 100 22', 'spontaneous'], ['M95 62 C112 52 126 42 138 32', 'pain'], ['M95 62 C115 60 130 54 148 50', 'bank']];
        br.forEach(function (b) { sv += '<path d="' + b[0] + '" stroke="' + (ink || col(b[1])) + '" stroke-width="2.4" fill="none" stroke-linecap="round"/>'; });
        br.forEach(function (b) {
          var m = b[0].split(' ').slice(-2), x = m[0], y = m[1];
          var pts = b[0].match(/-?\d+(\.\d+)?/g); var ex = pts[pts.length - 2], ey = pts[pts.length - 1];
          sv += '<circle cx="' + ex + '" cy="' + ey + '" r="3.4" fill="' + col(b[1]) + '" stroke="' + (dark ? bg : '#fff') + '" stroke-width="1.2"/>';
        });
        sv += '<path d="M90 70 L95 56 L100 70 Z" fill="' + tr + '"/></svg>';
        return sv;
      };

      grid.className = 'grid grid-cols-1 sm:grid-cols-3 gap-3';
      grid.innerHTML = '';
      ofrecidos.forEach(function (st) {
        var on = st.id === E.id;
        var b = document.createElement('button');
        b.type = 'button';
        b.setAttribute('aria-pressed', on ? 'true' : 'false');
        b.setAttribute('data-estilo', st.id);
        b.style.cssText = 'text-align:left;cursor:pointer;padding:10px;border-radius:12px;font-family:' + font + ';background:' + (LIGHT ? '#fff' : bl[900]) +
          ';border:2px solid ' + (on ? gr[700] : cardBorder) + ';box-shadow:' + (on ? SH.md : 'none') + ';transition:border-color .15s,box-shadow .15s';
        b.onmouseenter = function () { if (!on) b.style.borderColor = gr[600]; };
        b.onmouseleave = function () { if (!on) b.style.borderColor = cardBorder; };
        b.innerHTML = '<div style="margin-bottom:8px;border:1px solid ' + (LIGHT ? g[100] : bl[700]) + ';border-radius:8px;overflow:hidden">' + mini(st) + '</div>' +
          '<div style="font-size:14px;font-weight:700;color:' + cardInk + '">' + st.nombre + '</div>' +
          '<div style="font-size:12px;line-height:16px;color:' + cardSub + ';margin-top:2px">' + (st.descripcionCorta || st.descripcion) + '</div>' +
          (on ? '<div style="margin-top:6px;font-size:11px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;color:' + (LIGHT ? gr[700] : gr[300]) + '">✓ Activo</div>' : '');
        b.onclick = function (ev) { ev.stopPropagation(); if (!on) pick(st.id); };
        grid.appendChild(b);
      });

      // «Restablecer»: vuelve al estilo por defecto (el fondo ya lo define el estilo)
      if (resetBtn) {
        resetBtn.removeAttribute('onclick');
        resetBtn.innerHTML = '<i class="fa-solid fa-arrow-rotate-left text-[10px] text-emerald-400"></i> Restablecer estilo';
        resetBtn.onclick = function (ev) {
          ev.stopPropagation();
          var def = ofrecidos.filter(function (x) { return x.id === estilosFile.estiloPorDefecto; })[0] || ofrecidos[0];
          if (def && def.id !== E.id) pick(def.id);
        };
      }
      // La imagen de fondo personalizada no aplica con los estilos (cambiaría el fondo del otro sitio al compartir datos)
      var bgInput = document.getElementById('customBgUrlInput');
      var bgBlock = bgInput && bgInput.closest('.pt-3');
      if (bgBlock) bgBlock.style.display = 'none';
    } catch (e) { console.warn('[Tema Bci] panel de temas', e); }
  });
})();
