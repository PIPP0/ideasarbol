/* Aves visitantes — de vez en cuando un ave llega volando, se posa sobre el borde superior de una
 * tarjeta, se queda un rato (mira alrededor, picotea, mueve la cola, da saltitos, se gira) y vuelve a
 * irse. Son aves aparte de las cinco que vuelan por el fondo; esas no se tocan.
 *
 * Cómo se ve natural:
 *  - llegan por una curva, frenando al final y levantando el pecho (aleteo de aterrizaje);
 *  - al posarse pliegan las alas y aparecen las patas;
 *  - mientras están posadas hacen gestos pequeños en momentos al azar;
 *  - si se mueve o se borra la tarjeta, o se arrastra otra, se espantan y se van;
 *  - nunca se posan donde otra tarjeta taparía al ave.
 * Respetan «reducir movimiento» del sistema operativo (en ese caso no aparecen).
 */
/* ---- Interruptor de aves (siempre disponible, aunque el sistema pida reducir movimiento) ---- */
(function () {
  'use strict';
  var KEY = 'ideasarbol_aves', root = document.documentElement;
  try { if (localStorage.getItem(KEY) === '0') root.classList.add('aves-off'); } catch (e) {}
  var isOff = function () { return root.classList.contains('aves-off'); };
  function sync() {
    var b = document.getElementById('birdsToggle');
    if (b) b.setAttribute('aria-checked', isOff() ? 'false' : 'true');
  }
  function set(on) {
    root.classList.toggle('aves-off', !on);
    try { localStorage.setItem(KEY, on ? '1' : '0'); } catch (e) {}
    sync();
    if (!on && window.dsAvesApagar) window.dsAvesApagar(); // corta de inmediato las visitas en curso
    if (typeof showToast === 'function') showToast(on ? 'Aves activadas' : 'Aves apagadas');
  }
  function bind() {
    var b = document.getElementById('birdsToggle');
    if (!b) return;
    sync();
    b.addEventListener('click', function (e) { e.stopPropagation(); set(isOff()); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind); else bind();
})();

(function () {
  'use strict';
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  var NS = 'http://www.w3.org/2000/svg';
  var SCALE = 0.9;          // tamaño del ave (las de fondo van entre 0,3 y 0,95)
  var FEET = 9;             // distancia del centro del cuerpo a las patas, en unidades del dibujo
  var FLAP = [{ transform: 'rotate(0deg)' }, { transform: 'rotate(-50deg)' }, { transform: 'rotate(0deg)' }];

  var rand = function (a, b) { return a + Math.random() * (b - a); };
  var sleep = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
  var clamp = function (v, a, b) { return Math.max(a, Math.min(b, v)); };

  // Espera a que la página termine de cargar (el tema deja listos los colores de las aves en DOMContentLoaded)
  function ready(fn) {
    if (document.readyState === 'complete') setTimeout(fn, 0);
    else window.addEventListener('load', function () { setTimeout(fn, 0); });
  }

  ready(function () {
    var vp = document.getElementById('treeViewport');
    var cont = document.getElementById('treeCardsContainer');
    var B = window.DS_BIRD;
    if (!vp || !cont || !B) return;

    var svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('id', 'dsVisitors');
    svg.setAttribute('viewBox', '0 0 1400 900');
    svg.setAttribute('aria-hidden', 'true');
    svg.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;overflow:visible;z-index:25';
    vp.appendChild(svg);

    // Las aves de fondo se pasan a este plano (por delante de las tarjetas): así ningún ave
    // desaparece al cruzar detrás de una tarjeta. Sus rutas y animaciones no cambian.
    var bg = document.getElementById('animatedBirdsLayer');
    if (bg) svg.insertBefore(bg, svg.firstChild);

    var occupied = {}; // tarjetas con un ave encima

    // ---------- Dibujo del ave (de perfil, mira a +X) ----------
    function makeBird(color) {
      var wingColor = B.dark(color), beak = B.beak(color);
      var root = document.createElementNS(NS, 'g');
      root.style.opacity = '0';
      root.innerHTML =
        '<g class="vb-in">' +
          '<g class="vb-legs" style="opacity:0"><path d="M -2.2 4 L -2.6 9 M 2.2 4 L 2.6 9 M -2.6 9 L -4.6 9.2 M 2.6 9 L 4.6 9.2" stroke="' + B.ink + '" stroke-width="1.3" stroke-linecap="round" fill="none"/></g>' +
          '<path class="vb-wing-far" style="transform-origin:3px -2px" d="M 3 -2 Q -3 -15 -15 -19 Q -9 -8 -7 -1 Z" fill="' + wingColor + '" opacity=".55"/>' +
          '<polygon class="vb-tail" style="transform-origin:-9px 0px" points="-9,0 -21,-4 -21,3" fill="' + wingColor + '"/>' +
          '<ellipse cx="0" cy="0" rx="11" ry="4.6" fill="' + color + '"/>' +
          '<g class="vb-head" style="transform-origin:8px -1px">' +
            '<circle cx="11" cy="-2" r="3.7" fill="' + color + '"/>' +
            '<polygon points="14,-3 20,-1.4 14,-0.2" fill="' + beak + '"/>' +
            '<circle cx="12.2" cy="-2.7" r="1" fill="#fff"/><circle cx="12.5" cy="-2.7" r=".5" fill="#141B1F"/>' +
          '</g>' +
          '<path class="vb-wing" style="transform-origin:3px -2px" d="M 3 -2 Q -4 -17 -18 -21 Q -11 -9 -8 -0.5 Z" fill="' + wingColor + '"/>' +
        '</g>';
      svg.appendChild(root);
      var q = function (c) { return root.querySelector(c); };
      return { root: root, inner: q('.vb-in'), legs: q('.vb-legs'), wing: q('.vb-wing'), wingFar: q('.vb-wing-far'),
               tail: q('.vb-tail'), head: q('.vb-head'), wingAnims: [], x: 0, y: 0, rot: 0, sx: 1, spooked: false };
    }

    function pose(v, x, y, rot, sx) {
      v.x = x; v.y = y; v.rot = rot; v.sx = sx;
      v.root.style.transform = 'translate(' + x + 'px,' + y + 'px) rotate(' + rot + 'deg) scale(' + (sx * SCALE) + ',' + SCALE + ')';
    }

    // ---------- Alas ----------
    function stopWings(v) { v.wingAnims.forEach(function (a) { try { a.cancel(); } catch (e) {} }); v.wingAnims = []; }
    function wingAngle(el) {
      var m = getComputedStyle(el).transform;
      if (!m || m === 'none') return 0;
      var n = m.match(/matrix\(([^)]+)\)/);
      if (!n) return 0;
      var p = n[1].split(',').map(parseFloat);
      return Math.atan2(p[1], p[0]) * 180 / Math.PI;
    }
    function flap(v, period, delayFrac) {
      stopWings(v);
      var o = { duration: period, iterations: Infinity, easing: 'ease-in-out' };
      v.wingAnims = [v.wing.animate(FLAP, o),
        v.wingFar.animate(FLAP, { duration: period, iterations: Infinity, easing: 'ease-in-out', delay: -period * (delayFrac || 0.18) })];
    }
    function foldWings(v, ms) {
      var a1 = wingAngle(v.wing), a2 = wingAngle(v.wingFar);
      stopWings(v);
      var go = function (el, from, to) {
        return el.animate([{ transform: 'rotate(' + from + 'deg)' }, { transform: 'rotate(' + to + 'deg)' }],
          { duration: ms, easing: 'ease-out', fill: 'forwards' });
      };
      v.wingAnims = [go(v.wing, a1, -44), go(v.wingFar, a2, -38)];
    }
    function legs(v, on, ms) {
      v.legs.animate([{ opacity: on ? 0 : 1 }, { opacity: on ? 1 : 0 }], { duration: ms, fill: 'forwards' });
    }

    // ---------- Trayectorias ----------
    function catmull(pts, seg) {
      var out = [], P = [pts[0]].concat(pts, [pts[pts.length - 1]]);
      for (var i = 1; i < P.length - 2; i++) {
        for (var j = 0; j < seg; j++) {
          var t = j / seg, t2 = t * t, t3 = t2 * t, p0 = P[i - 1], p1 = P[i], p2 = P[i + 1], p3 = P[i + 2];
          var f = function (a, b, c, d) { return 0.5 * ((2 * b) + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3); };
          out.push({ x: f(p0.x, p1.x, p2.x, p3.x), y: f(p0.y, p1.y, p2.y, p3.y) });
        }
      }
      out.push(pts[pts.length - 1]);
      return out;
    }
    function makePath(pts) {
      var s = catmull(pts, 24), cum = [0], i;
      for (i = 1; i < s.length; i++) cum.push(cum[i - 1] + Math.hypot(s[i].x - s[i - 1].x, s[i].y - s[i - 1].y));
      var total = cum[cum.length - 1];
      return {
        length: total,
        at: function (u) {
          var d = clamp(u, 0, 1) * total, k = 1;
          while (k < cum.length - 1 && cum[k] < d) k++;
          var span = cum[k] - cum[k - 1] || 1, f = (d - cum[k - 1]) / span;
          return { x: s[k - 1].x + (s[k].x - s[k - 1].x) * f, y: s[k - 1].y + (s[k].y - s[k - 1].y) * f };
        }
      };
    }

    // Vuela a lo largo de una curva. opts: warp(t)->u, flare, fadeIn, fadeOut. Devuelve cuando llega.
    function fly(v, pts, dur, opts) {
      opts = opts || {};
      var path = makePath(pts), K = 90, frames = [], lastDir = opts.dir || 1, rotBase = 0;
      for (var k = 0; k <= K; k++) {
        var t = k / K, u = opts.warp ? opts.warp(t) : t;
        var p = path.at(u), a = path.at(Math.max(0, u - 0.01)), b = path.at(Math.min(1, u + 0.01));
        var dx = b.x - a.x, dy = b.y - a.y;
        if (Math.abs(dx) > 0.01) lastDir = dx > 0 ? 1 : -1;
        var pitch = clamp(Math.atan2(dy, Math.abs(dx) || 0.01), -0.45, 0.45) * 180 / Math.PI * 0.7;
        var rot = lastDir * pitch;
        if (opts.flare) { // al final levanta el pecho y se endereza
          var fb = t < 0.8 ? 0 : (t < 0.95 ? (t - 0.8) / 0.15 : 1 - (t - 0.95) / 0.05);
          rot = rot * (1 - fb) + lastDir * -32 * fb;
        }
        var op = 1;
        if (opts.fadeIn && t < 0.12) op = t / 0.12;
        if (opts.fadeOut && t > 0.85) op = (1 - t) / 0.15;
        frames.push({ transform: 'translate(' + p.x + 'px,' + p.y + 'px) rotate(' + rot + 'deg) scale(' + (lastDir * SCALE) + ',' + SCALE + ')', opacity: op });
        rotBase = rot;
      }
      var last = path.at(1);
      var anim = v.root.animate(frames, { duration: dur, easing: 'linear', fill: 'forwards' });
      return anim.finished.then(function () {
        pose(v, last.x, last.y, opts.endRot || 0, lastDir);
        v.root.style.opacity = opts.fadeOut ? '0' : '1';
        try { anim.cancel(); } catch (e) {}
      });
    }

    // ---------- Dónde posarse ----------
    function cardRects() {
      var out = [];
      [].slice.call(cont.children).forEach(function (el) {
        if (!el.offsetWidth || !el.offsetHeight) return;
        out.push({ el: el, id: el.getAttribute('data-id') || '', l: el.offsetLeft, t: el.offsetTop, w: el.offsetWidth, h: el.offsetHeight });
      });
      return out;
    }
    function pickSpot() {
      var cards = cardRects(), cands = [];
      cards.forEach(function (c) {
        if (!c.id || occupied[c.id] || c.t < 40) return;
        for (var n = 0; n < 4; n++) {
          var x = c.l + c.w * rand(0.18, 0.82), y = c.t;
          var covered = cards.some(function (o) {
            if (o === c) return false;
            // la zona que ocuparía el ave (encima del borde) debe estar libre
            return x + 18 > o.l && x - 18 < o.l + o.w && y > o.t - 2 && y - 22 < o.t + o.h;
          });
          if (!covered) { cands.push({ card: c, x: x, y: y }); break; }
        }
      });
      return cands.length ? cands[Math.floor(Math.random() * cands.length)] : null;
    }

    // ---------- Gestos mientras está posada ----------
    function gesture(el, frames, ms) { return el.animate(frames, { duration: ms, easing: 'ease-in-out' }).finished.catch(function () {}); }
    var ACTIONS = {
      look: function (v) {
        var a = rand(-12, 12);
        return gesture(v.head, [{ transform: 'rotate(0deg)' }, { transform: 'rotate(' + a + 'deg)', offset: 0.35 }, { transform: 'rotate(' + a + 'deg)', offset: 0.7 }, { transform: 'rotate(0deg)' }], rand(900, 1500));
      },
      peck: function (v) {
        var one = [{ transform: 'rotate(0deg)' }, { transform: 'rotate(30deg)', offset: 0.4 }, { transform: 'rotate(0deg)' }];
        return gesture(v.head, one, 280).then(function () { return Math.random() < 0.5 ? gesture(v.head, one, 280) : null; });
      },
      tail: function (v) {
        return gesture(v.tail, [{ transform: 'rotate(0deg)' }, { transform: 'rotate(-14deg)', offset: 0.3 }, { transform: 'rotate(5deg)', offset: 0.6 }, { transform: 'rotate(0deg)' }], 520);
      },
      hop: function (v) {
        return gesture(v.inner, [{ transform: 'translateY(0)' }, { transform: 'translateY(-7px)', offset: 0.45 }, { transform: 'translateY(0)' }], 360);
      },
      turn: function (v) {
        // pequeño salto y se gira hacia el otro lado
        setTimeout(function () { if (!v.spooked) pose(v, v.x, v.y, 0, -v.sx); }, 170);
        return gesture(v.inner, [{ transform: 'translateY(0)' }, { transform: 'translateY(-8px)', offset: 0.45 }, { transform: 'translateY(0)' }], 380);
      }
    };
    function pickAction() {
      var r = Math.random();
      return r < 0.34 ? 'look' : r < 0.58 ? 'peck' : r < 0.74 ? 'tail' : r < 0.88 ? 'hop' : 'turn';
    }

    // ---------- Una visita completa ----------
    // Se espanta si la tarjeta se mueve o desaparece, si se arrastra alguna, o si la seleccionan (toque/enfoque)
    function cardMoved(spot) {
      var el = cont.querySelector('[data-id="' + spot.card.id + '"]');
      if (!el || !el.isConnected) return true;
      if (el.classList.contains('card-focused')) return true;
      return Math.abs(el.offsetLeft - spot.card.l) > 2 || Math.abs(el.offsetTop - spot.card.t) > 2;
    }

    var off = function () { return document.documentElement.classList.contains('aves-off'); };

    function visit(v) {
      if (off()) return Promise.resolve(false);
      var spot = pickSpot();
      if (!spot) return Promise.resolve(false);
      var id = spot.card.id;
      occupied[id] = true;
      v.spotId = id;
      v.spooked = false;
      var s = SCALE, F = { x: spot.x, y: spot.y - FEET * s };
      var fromLeft = spot.x < 700 ? Math.random() < 0.8 : Math.random() < 0.2;
      var dir = fromLeft ? 1 : -1;
      var P0 = { x: fromLeft ? -90 : 1490, y: clamp(F.y - rand(140, 300), -20, 520) };
      var P1 = { x: P0.x + (F.x - P0.x) * 0.45, y: Math.min(P0.y, F.y) - rand(30, 90) };
      var P2 = { x: F.x - dir * rand(70, 110), y: F.y - rand(38, 58) };
      var dur = clamp(makePath([P0, P1, P2, F]).length / 110, 7000, 18000); // ≈110 unidades/s, como las aves de fondo

      v.legs.style.opacity = '0';
      v.inner.style.transform = '';
      pose(v, P0.x, P0.y, 0, dir);
      flap(v, 280);

      // llegada: frena al final (aleteo más rápido), pliega alas y saca las patas justo al tocar
      setTimeout(function () { if (!v.spooked) flap(v, 190, 0.12); }, dur * 0.82);
      setTimeout(function () { legs(v, true, 350); }, dur * 0.88);
      setTimeout(function () { foldWings(v, 320); }, dur * 0.965);

      var warp = function (t) {
        if (t < 0.8) return 0.85 * (t / 0.8);
        var x = (t - 0.8) / 0.2;
        return 0.85 + 0.15 * (1 - (1 - x) * (1 - x));
      };

      return fly(v, [P0, P1, P2, F], dur, { warp: warp, flare: true, fadeIn: true, dir: dir, endRot: 0 })
        .then(function () { return perch(v, spot); })
        .then(function () { return leave(v, spot); })
        .then(function () { delete occupied[id]; v.spotId = null; return true; })
        .catch(function (e) {
          delete occupied[id];
          v.spotId = null;
          stopWings(v);
          v.root.style.opacity = '0';
          if (!(e && e.name === 'AbortError')) console.warn('[Aves visitantes]', e);
          return false;
        });
    }

    // Espera algo, pero se interrumpe al instante si el ave se espanta
    function untilSpooked(v) {
      return new Promise(function (res) {
        var iv = setInterval(function () { if (v.spooked) { clearInterval(iv); res(); } }, 50);
        v.stopWatching = function () { clearInterval(iv); };
      });
    }
    function race(v, p) {
      var w = untilSpooked(v);
      return Promise.race([p, w]).then(function () { if (v.stopWatching) v.stopWatching(); });
    }

    function perch(v, spot) {
      var end = Date.now() + rand(6500, 14000);
      var step = function () {
        if (off()) v.spooked = true;
        if (v.spooked || Date.now() > end) return Promise.resolve();
        return race(v, sleep(rand(600, 1700))).then(function () {
          if (v.spooked || Date.now() > end) return null;
          return race(v, ACTIONS[pickAction()](v));
        }).then(step);
      };
      // vigilante: detecta rápido si la tarjeta se mueve, se arrastra alguna o la seleccionan
      var watch = setInterval(function () {
        if (cardMoved(spot) || document.querySelector('#treeCardsContainer .is-dragging')) v.spooked = true;
      }, 100);
      return step().then(function () { clearInterval(watch); }, function () { clearInterval(watch); });
    }

    function leave(v, spot) {
      if (off()) { stopWings(v); v.root.style.opacity = '0'; return Promise.resolve(); }
      var ex = Math.random() < 0.5 ? 1 : -1;
      var turn = ex !== v.sx ? gestureTurn(v, ex) : Promise.resolve();
      return turn.then(function () {
        var F = { x: v.x, y: v.y };
        // agacharse un instante y despegar con aleteo fuerte
        return gesture(v.inner, [{ transform: 'translateY(0) scaleY(1)' }, { transform: 'translateY(2px) scaleY(.88)' }], v.spooked ? 90 : 220)
          .then(function () {
            legs(v, false, 250);
            flap(v, 170, 0.1);
            var P1 = { x: F.x + ex * 30, y: F.y - 48 };
            var P2 = { x: F.x + ex * 150, y: F.y - 125 };
            var P3 = { x: ex > 0 ? 1580 : -180, y: Math.max(-40, F.y - rand(180, 300)) };
            var dur = clamp(makePath([F, P1, P2, P3]).length / 105, 6500, 16000);
            if (v.spooked) dur *= 0.65; // si la espantaron, sale más decidida pero sin disparar
            v.inner.style.transform = '';
            setTimeout(function () { flap(v, 280); }, 900);
            return fly(v, [F, P1, P2, P3], dur, { warp: function (t) { return t * (0.75 + 0.25 * t); }, fadeOut: true, dir: ex });
          });
      }).then(function () { stopWings(v); });
    }
    function gestureTurn(v, ex) {
      setTimeout(function () { pose(v, v.x, v.y, 0, ex); }, 170);
      return gesture(v.inner, [{ transform: 'translateY(0)' }, { transform: 'translateY(-8px)', offset: 0.45 }, { transform: 'translateY(0)' }], 380);
    }

    // ---------- Programación: visitas esporádicas ----------
    var colors = [B.colors[1], B.colors[3]]; // dos aves de colores distintos
    var visitors = colors.map(function (c) { return makeBird(c); });
    // ?aves=manual desactiva las visitas automáticas (sirve para pruebas con window.dsAvesVisitar)
    var manual = /[?&]aves=manual/.test(location.search);
    if (!manual) visitors.forEach(function (v, i) {
      (function loop(first) {
        var wait = first ? (i === 0 ? rand(6000, 11000) : rand(16000, 26000)) : rand(16000, 34000);
        setTimeout(function () {
          if (document.hidden || off() || !cardRects().length) { loop(false); return; }
          visit(v).then(function () { loop(false); });
        }, wait);
      })(true);
    });

    // Al tocar la tarjeta donde está posada, el ave sale volando
    cont.addEventListener('pointerdown', function (e) {
      var c = e.target.closest && e.target.closest('[data-id]');
      if (!c) return;
      var id = c.getAttribute('data-id');
      visitors.forEach(function (v) { if (v.spotId === id) v.spooked = true; });
    }, true);

    // Apagado inmediato desde el interruptor: corta vuelos en curso y esconde a las visitantes
    window.dsAvesApagar = function () {
      visitors.forEach(function (v) {
        v.spooked = true;
        try { v.root.getAnimations().forEach(function (an) { an.cancel(); }); } catch (e) {}
        stopWings(v);
        v.root.style.opacity = '0';
        if (v.stopWatching) v.stopWatching();
      });
    };

    // para pruebas manuales: window.dsAvesVisitar(0) hace llegar un ave de inmediato
    window.dsAvesVisitar = function (i) { return visit(visitors[i || 0]); };
  });
})();
