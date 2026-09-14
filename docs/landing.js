/* ================================================================
   Landing — motor de cena e narrativa

   Regra de ouro (herdada do portfolio.html, onde um bug de
   IntersectionObserver já escondeu conteúdo para sempre): NADA aqui
   pode esconder conteúdo de forma permanente. O CSS deixa tudo
   visível; o JS parte do visível e anima só a ENTRADA. Se as libs não
   carregarem, a página continua legível e completa.
   ================================================================ */

(function () {
  'use strict';

  var suave = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var toque = window.matchMedia('(hover: none), (pointer: coarse)').matches;

  /* ---------------------------------------------------------------
     1. Alternador de tema
     --------------------------------------------------------------- */
  (function tema() {
    var btn = document.getElementById('btnTema');
    if (!btn) return;
    btn.addEventListener('click', function () {
      var atual = document.documentElement.dataset.tema === 'escuro' ? 'claro' : 'escuro';
      document.documentElement.dataset.tema = atual;
      try { localStorage.setItem('tema', atual); } catch (e) {}
      /* o 3D lê as cores do tema: avisa para ele se repintar */
      if (window.__cena3d && window.__cena3d.repintar) window.__cena3d.repintar();
    });
  })();

  /* ---------------------------------------------------------------
     2. Barra ganha borda ao rolar
     --------------------------------------------------------------- */
  (function barra() {
    var el = document.getElementById('barra');
    if (!el) return;
    var ticking = false;
    window.addEventListener('scroll', function () {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(function () {
        el.classList.toggle('rolou', window.scrollY > 10);
        ticking = false;
      });
    }, { passive: true });
  })();

  /* ---------------------------------------------------------------
     3. Galeria: mostra 9 e revela o resto no botão

     O `.oculto` é aplicado AQUI, nunca no HTML — sem JS a galeria
     aparece inteira em vez de ficar cortada para sempre.
     --------------------------------------------------------------- */
  (function galeria() {
    var grade = document.getElementById('galeria');
    var btn = document.getElementById('btnMais');
    if (!grade || !btn) return;

    var itens = [].slice.call(grade.children);
    var VISIVEIS = 9;
    if (itens.length <= VISIVEIS) { btn.parentNode.style.display = 'none'; return; }

    itens.forEach(function (el, i) { if (i >= VISIVEIS) el.classList.add('oculto'); });

    btn.addEventListener('click', function () {
      itens.forEach(function (el) { el.classList.remove('oculto'); });
      btn.parentNode.style.display = 'none';
      if (window.ScrollTrigger) ScrollTrigger.refresh();
    });
  })();

  /* ---------------------------------------------------------------
     4. Objeto 3D que atravessa a narrativa

     Malha de pontos e linhas que gira, muda de lugar a cada cena e
     — principalmente — obedece ao ponteiro: a rotação persegue a
     posição do mouse/dedo, então gesto lento move devagar e gesto
     rápido é acompanhado com inércia.
     --------------------------------------------------------------- */
  (function tresD() {
    var canvas = document.getElementById('cena3d');
    if (!canvas || !window.THREE || suave) {
      document.body.classList.add('sem-webgl');
      return;
    }

    var renderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas: canvas, alpha: true, antialias: true });
    } catch (e) {
      document.body.classList.add('sem-webgl');
      return;
    }

    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);

    var cena = new THREE.Scene();
    var camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 100);
    camera.position.z = 5.2;

    var grupo = new THREE.Group();
    cena.add(grupo);

    var geo = new THREE.IcosahedronGeometry(1.7, 1);
    var matLinhas = new THREE.LineBasicMaterial({ transparent: true });
    var matPontos = new THREE.PointsMaterial({ size: 0.055, transparent: true });
    var matHalo = new THREE.LineBasicMaterial({ transparent: true });

    grupo.add(new THREE.LineSegments(new THREE.WireframeGeometry(geo), matLinhas));
    grupo.add(new THREE.Points(geo, matPontos));

    var halo = new THREE.LineSegments(
      new THREE.WireframeGeometry(new THREE.IcosahedronGeometry(2.9, 1)),
      matHalo
    );
    cena.add(halo);

    /* As cores saem do tema: no claro o traço precisa ser mais forte
       para não sumir no fundo branco. */
    function repintar() {
      var escuro = document.documentElement.dataset.tema === 'escuro';
      matLinhas.color.set(escuro ? 0x2FE0C8 : 0x0A7767);
      matLinhas.opacity = escuro ? 0.30 : 0.34;
      matPontos.color.set(escuro ? 0x5B9BFF : 0x2563EB);
      matPontos.opacity = escuro ? 0.85 : 0.6;
      matHalo.color.set(escuro ? 0x5B9BFF : 0x2563EB);
      matHalo.opacity = escuro ? 0.10 : 0.13;
    }
    repintar();

    var estado = { x: 2.1, y: 0, escala: 1, giro: 0 };

    /* --- obediência ao ponteiro --- */
    var alvoY = 0, alvoX = 0, gY = 0, gX = 0;
    var estreito = window.matchMedia('(max-width: 860px)');

    function apontar(cx, cy) {
      alvoY = ((cx / window.innerWidth) * 2 - 1) * 1.15;
      alvoX = ((cy / window.innerHeight) * 2 - 1) * 0.75;
    }

    window.addEventListener('mousemove', function (e) { apontar(e.clientX, e.clientY); }, { passive: true });
    window.addEventListener('touchmove', function (e) {
      if (e.touches && e.touches.length) apontar(e.touches[0].clientX, e.touches[0].clientY);
    }, { passive: true });
    document.addEventListener('mouseleave', function () { alvoY = 0; alvoX = 0; });

    var relogio = new THREE.Clock();
    var visivel = true;

    function loop() {
      requestAnimationFrame(loop);
      if (!visivel) return;
      var t = relogio.getElapsedTime();

      /* 0.055 = quanto do caminho até o alvo se percorre por quadro.
         É este número que faz o objeto ACOMPANHAR o gesto em vez de
         grudar no cursor. */
      gY += (alvoY - gY) * 0.055;
      gX += (alvoX - gX) * 0.055;

      grupo.rotation.y = t * 0.09 + gY + estado.giro;
      grupo.rotation.x = Math.sin(t * 0.1) * 0.12 + gX;
      halo.rotation.y = -t * 0.05 + gY * 0.45;
      halo.rotation.x = gX * 0.3;
      halo.rotation.z = t * 0.03;

      grupo.position.x += (estado.x - grupo.position.x) * 0.06;
      grupo.position.y += (estado.y - grupo.position.y) * 0.06;
      var e = grupo.scale.x + (estado.escala - grupo.scale.x) * 0.06;
      grupo.scale.set(e, e, e);
      halo.position.copy(grupo.position);

      renderer.render(cena, camera);
    }
    loop();

    document.addEventListener('visibilitychange', function () { visivel = !document.hidden; });

    window.addEventListener('resize', function () {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    });

    window.__cena3d = {
      repintar: repintar,
      ir: function (cfg) {
        if (typeof cfg.x === 'number') estado.x = estreito.matches ? 0 : cfg.x;
        if (typeof cfg.y === 'number') estado.y = cfg.y;
        if (typeof cfg.escala === 'number') estado.escala = cfg.escala;
        if (typeof cfg.giro === 'number') estado.giro = cfg.giro;
      },
    };
  })();

  /* ---------------------------------------------------------------
     5. Narrativa: o conteúdo se monta conforme a rolagem

     Duas mecânicas:
     - entrada com deslocamento AMPLO (60-90px), para o movimento ser
       perceptível de verdade
     - `scrub`: a animação é presa à barra de rolagem, então rolar
       metade mostra metade. Quem conduz é o dedo/roda, não um
       temporizador que dispara e acaba.
     --------------------------------------------------------------- */
  if (!window.gsap || !window.ScrollTrigger || suave) return;

  gsap.registerPlugin(ScrollTrigger);

  /* Título: cada linha sobe de trás da anterior, amarrada ao scroll. */
  gsap.utils.toArray('[data-titulo]').forEach(function (el) {
    var partes = el.querySelectorAll('span > i');
    var alvos = partes.length ? partes : [el];
    gsap.from(alvos, {
      scrollTrigger: {
        trigger: el,
        start: 'top 92%',
        end: 'top 45%',
        scrub: 0.8,
      },
      yPercent: 118,
      opacity: 0,
      stagger: 0.12,
      ease: 'power3.out',
    });
  });

  /* Blocos de texto: sobem bastante, presos à rolagem. */
  gsap.utils.toArray('[data-cena]').forEach(function (el) {
    gsap.from(el, {
      scrollTrigger: {
        trigger: el,
        start: 'top 95%',
        end: 'top 60%',
        scrub: 0.8,
      },
      y: 70,
      opacity: 0,
      ease: 'power2.out',
    });
  });

  /* Grupos: os filhos entram em cascata, também presos ao scroll. */
  gsap.utils.toArray('[data-cascata]').forEach(function (el) {
    gsap.from(el.children, {
      scrollTrigger: {
        trigger: el,
        start: 'top 95%',
        end: 'top 55%',
        scrub: 0.8,
      },
      y: 80,
      opacity: 0,
      stagger: 0.1,
      ease: 'power2.out',
    });
  });

  /* Projetos de desenvolvimento: texto e arte entram por lados
     opostos e a arte contra-rola — profundidade sem parallax de mouse. */
  gsap.utils.toArray('.projeto').forEach(function (proj) {
    var texto = proj.querySelector('.projeto-texto');
    var arte = proj.querySelector('.projeto-arte');
    var invertido = proj.classList.contains('invertido');

    if (texto) {
      gsap.from(texto, {
        scrollTrigger: { trigger: proj, start: 'top 90%', end: 'top 45%', scrub: 0.8 },
        x: invertido ? 90 : -90,
        opacity: 0,
        ease: 'power2.out',
      });
    }
    if (arte) {
      gsap.from(arte, {
        scrollTrigger: { trigger: proj, start: 'top 90%', end: 'top 45%', scrub: 0.8 },
        x: invertido ? -90 : 90,
        opacity: 0,
        scale: 0.92,
        ease: 'power2.out',
      });
      gsap.to(arte, {
        scrollTrigger: { trigger: proj, start: 'top bottom', end: 'bottom top', scrub: 0.6 },
        yPercent: -10,
        ease: 'none',
      });
    }
  });

  /* Itens da galeria: sobem em cascata conforme entram na tela. */
  gsap.utils.toArray('[data-item]').forEach(function (el, i) {
    gsap.from(el, {
      scrollTrigger: { trigger: el, start: 'top 96%', end: 'top 68%', scrub: 0.7 },
      y: 75,
      opacity: 0,
      scale: 0.95,
      ease: 'power2.out',
    });
  });

  /* Retrato da abertura: entra e depois desliza devagar ao rolar. */
  gsap.utils.toArray('[data-retrato]').forEach(function (el) {
    gsap.from(el, { y: 50, opacity: 0, duration: 1.1, ease: 'power3.out', delay: 0.15 });
    gsap.to(el, {
      scrollTrigger: { trigger: el, start: 'top top', end: 'bottom top', scrub: 0.6 },
      yPercent: -14,
      ease: 'none',
    });
  });

  /* --- o objeto 3D muda de lugar a cada cena --- */
  var canvas3d = document.getElementById('cena3d');
  var roteiro = [
    { sel: '#topo',            cfg: { x: 3.1,  y: 0.1,  escala: 0.9,  giro: 0   }, forca: 0.85 },
    { sel: '#sobre',           cfg: { x: -2.8, y: 0.5,  escala: 0.62, giro: 0.5 }, forca: 0.4 },
    { sel: '#trajetoria',      cfg: { x: 2.9,  y: -0.3, escala: 0.52, giro: 1.0 }, forca: 0.32 },
    { sel: '#ferramentas',     cfg: { x: -3.0, y: 0.6,  escala: 0.5,  giro: 1.4 }, forca: 0.32 },
    { sel: '#desenvolvimento', cfg: { x: 3.2,  y: 0.8,  escala: 0.42, giro: 1.8 }, forca: 0.24 },
    { sel: '#audiovisual',     cfg: { x: -3.3, y: -0.5, escala: 0.4,  giro: 2.1 }, forca: 0.2 },
    { sel: '#ia',              cfg: { x: 3.0,  y: 0.4,  escala: 0.55, giro: 2.4 }, forca: 0.3 },
    { sel: '#contato',         cfg: { x: 0,    y: 0,    escala: 1.3,  giro: 2.9 }, forca: 0.85 },
  ];

  roteiro.forEach(function (passo) {
    var el = document.querySelector(passo.sel);
    if (!el) return;
    function aplicar() {
      if (window.__cena3d) window.__cena3d.ir(passo.cfg);
      if (canvas3d) canvas3d.style.setProperty('--forca3d', passo.forca);
    }
    ScrollTrigger.create({
      trigger: el, start: 'top 60%', end: 'bottom 40%',
      onEnter: aplicar, onEnterBack: aplicar,
    });
  });

  /* --- barra de progresso --- */
  var barraProg = document.getElementById('progresso');
  if (barraProg) {
    gsap.to(barraProg, {
      scaleX: 1, ease: 'none',
      scrollTrigger: { start: 0, end: 'max', scrub: 0.3 },
    });
  }

  /* --- índice lateral --- */
  var botoes = [].slice.call(document.querySelectorAll('#indice button'));
  botoes.forEach(function (b) {
    var alvo = document.getElementById(b.dataset.ir);
    b.addEventListener('click', function () {
      if (alvo) alvo.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    if (!alvo) return;
    ScrollTrigger.create({
      trigger: alvo, start: 'top 55%', end: 'bottom 45%',
      onToggle: function (self) {
        if (!self.isActive) return;
        botoes.forEach(function (o) { o.classList.remove('ativo'); });
        b.classList.add('ativo');
      },
    });
  });

  /* imagens que chegam depois mudam a altura da página; sem isto os
     gatilhos ficam calculados sobre medidas velhas */
  window.addEventListener('load', function () { ScrollTrigger.refresh(); });
})();
