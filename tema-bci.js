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

  // =====================================================================
  //  Dibujo del árbol (SVG)
  // =====================================================================
  var S = H + '#treeSvg ';
  // Sin brillos difuminados en modo claro (se ven sucios sobre blanco)
  if (LIGHT) {
    add(S + '[filter], ' + S + '#dynamicSubBranches, ' + S + '#branchConnectors [filter]', 'filter:none !important');
    add(S + '#animatedBirdsLayer', 'display:none');
    add(S + '.leaf-pulse', 'animation:none !important');
    add(S + 'path[d="M 700 800 L 700 380"]', 'display:none');
  }
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

    try {
      var host = document.getElementById('canvasContainer');
      if (!host || estilos.length < 2) return;
      var bar = document.createElement('div');
      bar.id = 'dsStyleSwitcher';
      bar.setAttribute('role', 'group');
      bar.setAttribute('aria-label', 'Estilo visual');
      bar.style.cssText = 'position:absolute;left:50%;bottom:18px;transform:translateX(-50%);z-index:35;display:flex;gap:4px;align-items:center;padding:5px;border-radius:9999px;' +
        'background:' + (LIGHT ? '#fff' : bl[900]) + ';border:1px solid ' + (LIGHT ? g[100] : bl[700]) + ';box-shadow:' + SH.md + ';font-family:' + font;
      var lbl = document.createElement('span');
      lbl.textContent = 'Estilo';
      lbl.style.cssText = 'font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;padding:0 8px 0 10px;color:' + (LIGHT ? g[600] : bl[200]);
      bar.appendChild(lbl);
      estilos.forEach(function (st, i) {
        var b = document.createElement('button');
        b.type = 'button';
        b.title = st.descripcion || st.nombre;
        b.textContent = (i + 1) + ' · ' + st.nombre;
        var on = st.id === E.id;
        b.style.cssText = 'cursor:pointer;border:0;border-radius:9999px;padding:6px 12px;font-size:12px;font-weight:600;white-space:nowrap;font-family:' + font + ';' +
          (on ? 'background:' + gr[700] + ';color:#fff' : 'background:transparent;color:' + (LIGHT ? g[700] : bl[100]));
        b.onclick = function (ev) {
          ev.stopPropagation();
          try { localStorage.setItem(STORE_KEY, st.id); } catch (e) {}
          var u = new URL(location.href);
          u.searchParams.set('estilo', st.id);
          location.href = u.toString();
        };
        bar.appendChild(b);
      });
      host.appendChild(bar);
    } catch (e) { console.warn('[Tema Bci] selector', e); }
  });
})();
