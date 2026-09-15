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
     3. Grade audiovisual: mostra 9 e revela o resto no botão

     Migrado do portfolio.html junto com a grade de cards. O
     `.extra-card` é aplicado AQUI, nunca no HTML — sem JS a grade
     aparece inteira em vez de ficar cortada para sempre.
     --------------------------------------------------------------- */
  (function verMaisVideos() {
    var grade = document.getElementById('audiovisualGrid');
    var btn = document.getElementById('loadMoreBtn');
    if (!grade || !btn) return;

    var VISIVEIS = 9;
    var cards = [].slice.call(grade.querySelectorAll('.work-card'));
    var extras = cards.slice(VISIVEIS);

    if (extras.length === 0) { btn.parentNode.style.display = 'none'; return; }

    extras.forEach(function (el) { el.classList.add('extra-card'); });

    function atualizarBotao() {
      var aberta = grade.classList.contains('expanded');
      btn.textContent = aberta ? 'Ver menos' : 'Ver mais vídeos (+' + extras.length + ')';
      btn.setAttribute('aria-expanded', aberta ? 'true' : 'false');
    }

    btn.setAttribute('aria-controls', 'audiovisualGrid');
    atualizarBotao();

    btn.addEventListener('click', function () {
      grade.classList.toggle('expanded');
      atualizarBotao();
      if (!grade.classList.contains('expanded')) {
        btn.scrollIntoView({ block: 'center', behavior: 'smooth' });
      }
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

    /* --- A ROLAGEM é quem conduz o objeto ---
       `alvoRolagem` é 0 no topo da página e 1 no fim. O objeto deriva
       essa posição diretamente: descer o avança, subir o RETROCEDE pelo
       mesmo caminho. Não há animação própria de trajeto — quem move é o
       gesto de rolar, como o conteúdo.

       `posRolagem` persegue o alvo devagar (0.045 por quadro), então o
       movimento acompanha a rolagem em vez de colar nela: arrastar
       devagar move devagar, e o objeto desacelera sozinho ao parar. */
    var alvoRolagem = 0;
    var posRolagem = 0;

    function lerRolagem() {
      var doc = document.documentElement;
      var max = (doc.scrollHeight - window.innerHeight) || 1;
      alvoRolagem = Math.min(1, Math.max(0, window.scrollY / max));
    }
    lerRolagem();
    window.addEventListener('scroll', lerRolagem, { passive: true });
    window.addEventListener('resize', lerRolagem);

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

      /* mesma perseguição para a rolagem, um pouco mais preguiçosa */
      posRolagem += (alvoRolagem - posRolagem) * 0.045;
      var p = posRolagem;

      /* Trajeto derivado da rolagem: o objeto cruza a tela em S, mergulha
         e volta a crescer no fim. Tudo é função de `p`, então subir a
         página refaz o caminho ao contrário, exatamente. */
      var largura = estreito.matches ? 0 : 3.1;
      var x = Math.sin(p * Math.PI * 2.1) * largura;
      var y = Math.cos(p * Math.PI * 1.7) * 0.75;
      var escala = 0.95 - Math.sin(p * Math.PI) * 0.55;   /* encolhe no meio, volta no fim */

      grupo.position.x += (x - grupo.position.x) * 0.08;
      grupo.position.y += (y - grupo.position.y) * 0.08;
      var e = grupo.scale.x + (escala - grupo.scale.x) * 0.08;
      grupo.scale.set(e, e, e);
      halo.position.copy(grupo.position);

      /* A rotação também é da rolagem (p * 5.2), somada ao ponteiro e a
         uma deriva mínima — para o objeto respirar quando tudo está parado. */
      grupo.rotation.y = p * 5.2 + gY + t * 0.03;
      grupo.rotation.x = p * 1.6 + gX;
      halo.rotation.y = -p * 2.6 + gY * 0.45 - t * 0.02;
      halo.rotation.x = gX * 0.3;
      halo.rotation.z = p * 0.9;

      renderer.render(cena, camera);
    }
    loop();

    document.addEventListener('visibilitychange', function () { visivel = !document.hidden; });

    window.addEventListener('resize', function () {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    });

    window.__cena3d = { repintar: repintar };
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
    /* Um rótulo entre duas grades tem pouca folga acima: com 70px de curso
       ele atravessava a grade anterior durante a entrada ("TECNOLOGIA"
       aparecia por cima dos cartões). Curso curto onde o espaço é curto. */
    var apertado = el.classList.contains('sub-rotulo');
    gsap.from(el, {
      scrollTrigger: {
        trigger: el,
        start: 'top 98%',
        /* curso mais longo (98% -> 45% da tela) para a entrada ser
           perceptivel durante o gesto de rolar, em vez de se resolver em
           poucos pixels */
        end: apertado ? 'top 70%' : 'top 45%',
        scrub: 0.8,
      },
      y: apertado ? 18 : 70,
      opacity: 0,
      ease: 'power2.out',
    });
  });

  /* Grupos: os filhos entram em cascata, também presos ao scroll.

     `end` usa 'bottom' do próprio grupo, não 'top': com 'top 55%' a
     animação terminava enquanto o bloco ainda estava entrando, e o
     `stagger` deixava os últimos cartões parados a 80px do lugar. Como
     transform não conta na altura do container, eles desciam por cima do
     rótulo seguinte — era isso que punha "TECNOLOGIA" sobre um cartão.

     `invalidateOnRefresh` + `clearProps` garantem que o transform é
     removido ao terminar, em vez de ficar cravado no estilo inline. */
  gsap.utils.toArray('[data-cascata]').forEach(function (el) {
    /* O curso precisa crescer com o NUMERO de filhos. Com `stagger`, cada
       item so ocupa uma fatia do curso total: num bloco de 3 (os numeros
       3+/30+/ADS) a fatia e generosa e a entrada se ve bem; numa grade de
       19 cartoes a mesma janela dava ~150px no total e cada cartao aparecia
       de um quadro para o outro — que e a sensacao de "nao tem animacao".
       Medido: 3 filhos -> 350px de curso; 19 filhos -> 150px. Alongar o
       `end` conforme a quantidade reequilibra isso. */
    var n = el.children.length;
    var pct = n > 12 ? 0.05 : (n > 6 ? 0.2 : 0.35);

    /* O ULTIMO bloco da pagina nunca alcanca esse ponto final. A cascata e
       `scrub` (presa a rolagem), e ela so termina quando o TOPO do bloco sobe
       ate `pct` da tela — mas no fim da pagina a rolagem ACABA antes disso.
       Medido nos icones de contato: mesmo no fim absoluto, faltavam 369px
       (390x844) e 406px (1440x900) de rolagem. Resultado: a animacao
       congelava no meio — icones a 42% de opacidade e 46px deslocados para
       baixo, parecendo "bugados" e sugerindo que havia mais pagina abaixo.

       Entao o fim do curso e o MENOR entre o ponto desejado e o quanto de
       rolagem ainda existe de verdade. Funcao (nao string) porque
       `invalidateOnRefresh` a reavalia a cada resize, quando a altura da
       pagina muda. */
    var fim = function () {
      var doc = document.documentElement;
      var restante = doc.scrollHeight - window.innerHeight - el.getBoundingClientRect().top - window.scrollY;
      var desejado = el.getBoundingClientRect().top + window.scrollY - window.innerHeight * pct;
      var inicio = el.getBoundingClientRect().top + window.scrollY - window.innerHeight * 0.98;
      var curso = Math.max(0, desejado - inicio);
      /* folga de 8px: encostar no limite exato deixa o scrub sem o ultimo
         quadro em alguns navegadores */
      return '+=' + Math.max(1, Math.min(curso, Math.max(0, restante - 8)));
    };

    gsap.fromTo(el.children, {
      y: 80,
      opacity: 0,
    }, {
      scrollTrigger: {
        trigger: el,
        start: 'top 98%',
        /* ancorado no TOPO do bloco, nao no `bottom`: numa grade alta o
           `bottom` ja passou do ponto quando o topo entra, e o curso
           inteiro se resolvia em poucos pixels */
        end: fim,
        scrub: 0.8,
        invalidateOnRefresh: true,
      },
      /* estado final ESCRITO, nao inferido: com `from` o GSAP le o estilo
         corrente como destino, e num bloco que nunca completa o curso isso
         deixava o valor final indefinido. */
      y: 0,
      opacity: 1,
      stagger: 0.1,
      ease: 'power2.out',
      clearProps: 'transform',
    });
  });

  /* Projetos de desenvolvimento: texto e arte entram por lados
     opostos e a arte contra-rola — profundidade sem parallax de mouse. */
  gsap.utils.toArray('.projeto').forEach(function (proj) {
    var texto = proj.querySelector('.projeto-texto');
    var arte = proj.querySelector('.projeto-arte');
    var invertido = proj.classList.contains('invertido');

    /* A entrada é VERTICAL, não lateral. Com `x: -90` o bloco ficava a
       -69px da borda enquanto não entrava — fora da tela em qualquer
       largura até 1280px. O deslocamento lateral só cabe onde há folga
       horizontal, e aqui não há. */
    var lateral = window.innerWidth >= 1280 ? 60 : 0;

    if (texto) {
      gsap.from(texto, {
        scrollTrigger: { trigger: proj, start: 'top 90%', end: 'top 45%', scrub: 0.8 },
        x: invertido ? lateral : -lateral,
        y: 60,
        opacity: 0,
        ease: 'power2.out',
      });
    }
    if (arte) {
      gsap.from(arte, {
        scrollTrigger: { trigger: proj, start: 'top 90%', end: 'top 45%', scrub: 0.8 },
        x: invertido ? -lateral : lateral,
        y: 60,
        opacity: 0,
        scale: 0.94,
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

  /* Retrato da abertura: entra, desliza devagar ao rolar e se dissolve.
     O parallax (yPercent) e o esmaecimento sao tweens SEPARADOS de
     proposito: o deslize acompanha a capa inteira, enquanto o sumico so
     comeca depois que a pessoa ja passou de metade dela — assim a foto
     nao apaga enquanto ainda e o assunto da tela.
     `fromTo` com estado final escrito, e nao `from`: num tween preso a
     rolagem que pode nao completar o curso, o `from` infere o destino do
     estilo corrente e a foto pode ficar meio transparente para sempre. */
  gsap.utils.toArray('[data-retrato]').forEach(function (el) {
    gsap.from(el, { y: 50, opacity: 0, duration: 1.1, ease: 'power3.out', delay: 0.15 });
    gsap.to(el, {
      scrollTrigger: { trigger: el, start: 'top top', end: 'bottom top', scrub: 0.6 },
      yPercent: -14,
      ease: 'none',
    });
    gsap.fromTo(el, { opacity: 1 }, {
      scrollTrigger: {
        trigger: el,
        /* comeca na metade da capa e termina quando a foto sai por cima */
        start: 'center 45%',
        end: 'bottom 12%',
        scrub: 0.6,
        invalidateOnRefresh: true,
      },
      opacity: 0,
      ease: 'none',
    });
  });

  /* --- presença do objeto por seção ---
     A POSIÇÃO do objeto vem da rolagem (ver bloco 4); aqui só se ajusta
     o quanto ele aparece: forte na abertura e no fecho, discreto onde há
     texto e imagem para ler. */
  var canvas3d = document.getElementById('cena3d');
  var presenca = [
    { sel: '#topo',            forca: 0.85 },
    { sel: '#sobre',           forca: 0.4 },
    { sel: '#trajetoria',      forca: 0.32 },
    { sel: '#ferramentas',     forca: 0.32 },
    { sel: '#desenvolvimento', forca: 0.22 },
    { sel: '#audiovisual',     forca: 0.18 },
    { sel: '#ia',              forca: 0.3 },
    { sel: '#contato',         forca: 0.85 },
  ];

  presenca.forEach(function (passo) {
    var el = document.querySelector(passo.sel);
    if (!el || !canvas3d) return;
    function aplicar() { canvas3d.style.setProperty('--forca3d', passo.forca); }
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

    /* ---------- Case imersivo: overlay full-screen por projeto ----------
       Cada projeto vira uma sequencia de "cenas". O print fica de fundo em
       tela cheia e o scroll troca de cena com fade. Fecha no Esc/X/fim. */

    (function () {
      var CASES = {
        'mix-de-fone': {
          who: 'Mix de Fone · Soundcraft Ui24R',
          cenas: [
            {
              img: 'images/projetos/mixfone-01-mix.png',
              capa: true,
              titulo: 'Mix de Fone',
              texto: 'Cada músico controla o próprio fone pelo celular numa mesa Soundcraft Ui24R — sem receber acesso à mesa inteira. Um servidor Node.js segura uma única conexão WebSocket com a mesa e distribui para todo mundo, contornando o limite de conexões simultâneas do equipamento.',
              chips: ['Node.js', 'WebSocket', 'PWA', 'Soundcraft Ui24R'],
              links: [
                { label: 'Ver repositório', href: 'https://github.com/mpaulinhu/ui24-musicos', tipo: 'primary' }
              ]
            },
            {
              img: 'images/projetos/mixfone-07-login.png',
              step: 'A entrada',
              titulo: 'Cada músico só enxerga o próprio fone',
              texto: 'O músico escolhe o instrumento e entra com senha própria. A partir daí ele vê só os canais que interessam pra ele, com nome legível — "Violão", "Teclado L" — em vez do número cru do canal na mesa, e não alcança o mix de mais ninguém.'
            },
            {
              img: 'images/projetos/mixfone-02-mobile.png',
              phone: true,
              alt: 'Tela do músico no celular, com os canais em grid de duas linhas',
              step: 'No celular',
              titulo: 'Feito para usar tocando',
              texto: 'É onde o projeto realmente vive: instalável como app, os canais viram um grid de duas linhas com scroll lateral. Dá pra ajustar o fone entre um louvor e outro sem sair do lugar.',
              chips: ['PWA', 'Mobile-first']
            },
            {
              img: 'images/projetos/mixfone-03-chat.png',
              step: 'Chat integrado',
              titulo: 'Pedido sem sinal de mão',
              texto: 'Atalhos prontos para os pedidos de sempre — "+ minha voz", "fone baixo", "microfonia!" — e campo livre pro resto. Resolve a comunicação que antes era gesto no meio do culto.'
            },
            {
              img: 'images/projetos/mixfone-04-monitor.png',
              step: 'Do outro lado',
              titulo: 'A tela da House Mix',
              texto: 'O operador acompanha num monitor à parte quem está online e o que cada um pediu, com horário. O mesmo servidor que fala com a mesa entrega o chat de graça.'
            },
            {
              img: 'images/projetos/mixfone-05-geral.png',
              step: 'Mute geral',
              titulo: 'Tirar o instrumento de todos os fones',
              texto: 'Quando o músico não está tocando, ele mesmo se tira de todos os fones e do som principal — sem depender de alguém na mesa para fazer isso.'
            },
            {
              img: 'images/projetos/mixfone-06-admin.png',
              step: 'Configuração',
              titulo: 'Painel de admin completo',
              texto: 'IP da mesa, senhas, músicos, canais e pares estéreo — tudo editável por tela, sem mexer em arquivo de configuração. Salvar reconecta o servidor sozinho.',
              chips: ['Config por UI', 'Sem editar JSON']
            }
          ]
        },
        'elo-ecosystem': {
          who: 'ELO Ecosystem · CoreHUB',
          demo: true,
          cenas: [
            {
              img: 'images/projetos/corehub-01-catalogo.png',
              capa: true,
              alt: 'Tela de catálogo do CoreHUB com livros em grade',
              titulo: 'Um sistema, duas editoras',
              texto: 'O CoreHUB é o sistema interno onde a ELO Editora e a PeraBook operam por inteiro — do cadastro do livro à venda, da produção do audiovisual ao recrutamento. São mais de 30 áreas num só lugar, cobrindo o que antes vivia espalhado em planilhas e sistemas separados. Desenvolvido em equipe com Dalila Rodrigues e Vander Loto.',
              chips: ['React 19', 'TypeScript', 'Vite', 'Firestore', 'Cloud Functions', 'Tailwind']
            },
            {
              img: 'images/projetos/corehub-05-menu.png',
              alt: 'Menu lateral do CoreHUB com as seis áreas do sistema',
              step: 'O que cabe dentro',
              titulo: 'Seis frentes, uma base só',
              texto: 'Acervo (catálogo, biblioteca digital, autores, coleções, validação). Produção (audiovisual, pipeline de EPUB, acessibilidade). Escritório de Projetos (editorial, tecnologia, marketing, dashboards). Comercialização (preços, estoque, publicação, promoções, códigos). Vendas (pedidos, devoluções, clientes, kits escolares, analytics). E presença digital, com os sites das duas marcas editáveis por lá.',
              chips: ['30+ áreas', 'Multi-marca', '5 níveis de acesso']
            },
            {
              img: 'images/projetos/corehub-02-dashboard.png',
              step: 'Integrações',
              titulo: 'O sistema conversa com o resto',
              texto: 'ERP Versa para preço e estoque, Mercado Pago e Stripe no checkout, ClickUp e Microsoft Planner alimentando os projetos, Teams para avisos, EPUBCheck validando cada livro digital. Cerca de 100 Cloud Functions ligam essas pontas — o mesmo cadastro alimenta o site, o app de leitura, o relatório e a nota, sem ninguém redigitar nada.',
              chips: ['ERP Versa', 'Mercado Pago', 'Stripe', 'ClickUp', 'Planner', 'Teams']
            },
            {
              img: 'images/projetos/corehub-03-carga.png',
              step: 'PM Office',
              titulo: 'Do acompanhamento à decisão',
              texto: 'KPIs por status, progresso por projeto agrupado por área e carga por pessoa na mesma tela. Os cartões filtram a visão ao serem clicados, então ela responde tanto "como estamos?" quanto "o que travou e com quem". Foi a frente em que atuei mais diretamente.',
              chips: ['Gráficos', 'Filtro cruzado']
            },
            {
              img: 'images/projetos/corehub-04-mobile.png',
              phone: true,
              alt: 'Catálogo do CoreHUB no celular, em duas colunas',
              step: 'No celular',
              titulo: 'Responsivo de verdade',
              texto: 'A sidebar recolhe, o grid cai para duas colunas e os alvos de toque crescem. Consultar catálogo fora da mesa é caso de uso real — não sobra de layout. Acessibilidade WCAG 2.2 AA é requisito, não item de desejo.',
              chips: ['Mobile-first', 'WCAG 2.2 AA']
            }
          ]
        },
        'sthe': {
          who: 'STHE · controle de pagamentos',
          cenas: [
            {
              img: 'images/projetos/sthe-01-pagamentos.png',
              capa: true,
              alt: 'Tela de pagamentos da equipe, com totais do mês e lista de pessoas',
              titulo: 'Quem recebe o quê, e o que já saiu do caixa',
              texto: 'Sistema de organização interna para uma equipe de salão. A tela principal responde as perguntas do mês numa olhada: quanto falta pagar, quanto está em atraso, qual o próximo vencimento e quanto já saiu. A lista separa por situação e permite marcar vários pagamentos de uma vez.',
              chips: ['React', 'TypeScript', 'Vite', 'Vitest'],
              links: [
                { label: 'Ver repositório', href: 'https://github.com/mpaulinhu/sthe', tipo: 'primary' }
              ]
            },
            {
              img: 'images/projetos/sthe-02-relatorios.png',
              step: 'Relatórios',
              titulo: 'Quanto custa a equipe, mês a mês',
              texto: 'Folha do mês, custo médio por pessoa e a evolução ao longo do tempo, com o peso de cada função no total. A tela existe para a pergunta que aparece depois do dia a dia resolvido: para onde o dinheiro está indo, e como isso muda de um mês para o outro.',
              chips: ['Folha por função', 'Histórico mensal', 'Recibos assinados']
            },
            {
              img: 'images/projetos/sthe-03-equipe.png',
              step: 'Cadastro',
              titulo: 'Cadastra uma vez, lança todo mês',
              texto: 'Cada pessoa é cadastrada uma única vez — função, forma de pagamento, valor de referência e dia de vencimento. Depois, mês a mês, é só escolher quem entra e lançar os valores. A lógica de cálculo tem testes automatizados, porque erro em conta de pagamento não é aceitável.',
              chips: ['Fixo, freela ou diarista', 'Vale no meio do mês', 'Backup local']
            },
            {
              img: 'images/projetos/sthe-04-mobile.png',
              phone: true,
              alt: 'STHE no celular, com a tela de pagamentos adaptada',
              step: 'No celular',
              titulo: 'Consulta fora do balcão',
              texto: 'A interface acompanha a tela pequena porque a consulta real acontece fora da mesa. Os dados ficam no próprio aparelho, com exportação de backup — sem depender de servidor no ar para uma operação que precisa funcionar sempre.',
              chips: ['Responsivo', 'Dados locais']
            }
          ]
        },
        'coredja': {
          who: 'Coredja · comunicação interna',
          cenas: [
            {
              img: 'images/projetos/coredja-01-entrada.png',
              capa: true,
              alt: 'Tela de entrada do Coredja',
              titulo: 'Recado que chega sem gritar do outro lado do salão',
              texto: 'Durante um culto, a Cantina e o Kids precisam falar com o audiovisual — e a única via costumava ser alguém atravessar o salão. O Coredja liga essas áreas: cada setor manda o recado pelo celular e o operador recebe num painel que atualiza sozinho, sem precisar recarregar nada.',
              chips: ['Next.js', 'TypeScript', 'Firestore', 'SQLite'],
              links: [
                { label: 'Ver repositório', href: 'https://github.com/mpaulinhu/coredja', tipo: 'primary' },
                { label: 'Abrir o site', href: 'https://coredja.vercel.app', tipo: 'ghost' }
              ]
            },
            {
              step: 'Arquitetura',
              titulo: 'O mesmo sistema, dois armazenamentos',
              texto: 'Uma variável de configuração troca a base inteira entre SQLite (arquivo local, funciona sem internet, para rodar no PC da igreja) e Firestore (nuvem, tempo real entre aparelhos). Nenhuma tela muda — a decisão de onde os dados moram fica isolada de quem os exibe.',
              chips: ['SQLite', 'Firestore', 'Configuração por ambiente']
            },
            {
              step: 'Integração',
              titulo: 'Do recado ao telão',
              texto: 'Publicar um aviso no Coredja também pode mandar o texto para o telão, via API do Holyrics. A chamada sai do servidor, nunca do navegador, para o token não chegar ao cliente. Publicado na internet, uma ponte instalada no PC do audiovisual executa o comando na rede local — o servidor hospedado não alcança um endereço privado.',
              chips: ['API do Holyrics', 'Web Push', 'PWA']
            }
          ]
        },
        'site-bolos': {
          who: 'Cida Tavares · bolos e pães',
          cenas: [
            {
              img: 'images/projetos/bolos-01-capa.png',
              capa: true,
              alt: 'Página inicial do site Cida Tavares',
              titulo: 'Uma página, um pedido no WhatsApp',
              texto: 'Site de página única para uma confeitaria artesanal. O objetivo é direto: mostrar o que tem hoje e levar a pessoa ao WhatsApp com o pedido já escrito. Sem carrinho, sem cadastro, sem etapa a mais entre a vontade do bolo e a mensagem enviada.',
              chips: ['HTML', 'CSS', 'JavaScript'],
              links: [
                { label: 'Ver repositório', href: 'https://github.com/mpaulinhu/site-bolos-paes', tipo: 'primary' }
              ]
            },
            {
              img: 'images/projetos/bolos-02-cardapio.png',
              step: 'Cardápio',
              titulo: 'Filtra por categoria, pede em um toque',
              texto: 'Bolos, pães, doces e salgados separados por filtro, cada item com descrição, preço e botão próprio de pedido. Trocar um produto ou um valor é editar uma linha do arquivo — a pessoa que cuida do site não precisa de painel, build nem banco de dados.',
              chips: ['Sem build', 'Sem dependências', 'Fácil de editar']
            },
            {
              img: 'images/projetos/bolos-03-mobile.png',
              phone: true,
              alt: 'Site Cida Tavares no celular',
              step: 'No celular',
              titulo: 'Feito para onde o cliente está',
              texto: 'A maior parte do tráfego de um negócio assim chega pelo celular, vindo de rede social. O layout nasce pensado para essa tela, com o botão de pedido sempre à mão enquanto se rola o cardápio.',
              chips: ['Mobile-first', 'WhatsApp']
            }
          ]
        },
        'automacao-transmissao': {
          who: 'Automação de transmissão · multi-PC',
          cenas: [
            {
              img: 'images/projetos/automacao-01-online.png',
              capa: true,
              titulo: 'Um clique, três computadores',
              texto: 'Começar uma transmissão ao vivo era abrir programa por programa em três máquinas diferentes. Agora é um botão: o painel dispara em paralelo para os três PCs pela rede local, e cada agente abre o que é dele.',
              chips: ['Python', 'Flask', 'PWA', 'Rede local'],
              links: [
                { label: 'Ver repositório', href: 'https://github.com/mpaulinhu/automarizar-apps-em-PCs-diferentes', tipo: 'primary' }
              ]
            },
            {
              img: 'images/projetos/automacao-03-offline.png',
              step: 'Quando dá ruim',
              titulo: 'Falha que aparece',
              texto: 'O painel faz ping nos três agentes a cada 5 segundos. Se um não responde, ele diz qual e por quê, em vez de travar em silêncio — saber que o PC2 está fora antes de subir ao vivo é metade do problema resolvido. Cada agente também devolve o que abriu e o que falhou, com hora carimbada.',
              chips: ['Holyrics', 'Lumikit', 'vMix', 'Reaper']
            },
            {
              img: 'images/projetos/automacao-02-mobile.png',
              phone: true,
              alt: 'Painel de controle da live no celular, com o botão Iniciar tudo',
              step: 'No celular',
              titulo: 'Dispara do bolso',
              texto: 'Instalável como app no celular. Dá pra iniciar tudo a caminho da mesa, sem precisar sentar em nenhum dos três computadores primeiro. O projeto nasceu da rotina de transmitir ao vivo toda semana — cada detalhe responde a um problema que eu mesmo tive na hora de subir a live.',
              chips: ['PWA', 'Mobile']
            }
          ]
        }
      };

      var overlay = document.getElementById('caseOverlay');
      if (!overlay) return;

      var stage = document.getElementById('caseStage');
      var scenesWrap = document.getElementById('caseScenes');
      var scroller = document.getElementById('caseScroll');
      var dotsWrap = document.getElementById('caseDots');
      var whoEl = document.getElementById('caseWho');
      var demoTag = document.getElementById('caseDemoTag');
      var closeBtn = document.getElementById('caseClose');
      var hint = document.getElementById('caseHint');
      var progressBar = document.getElementById('caseProgressBar');

      var atual = -1;
      var shots = [];
      var scenes = [];
      var dots = [];
      var aberto = false;
      var lastFocus = null;

      function esc(s) {
        return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
          return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
        });
      }

      function montar(dados) {
        stage.innerHTML = '';
        scenesWrap.innerHTML = '';
        dotsWrap.innerHTML = '';
        shots = [];
        scenes = [];
        dots = [];
        atual = -1;

        whoEl.textContent = dados.who;
        // Selo de dados ficticios: obrigatorio quando as telas sao de sistema
        // interno reconstruido com conteudo inventado (nada real aparece).
        demoTag.hidden = !dados.demo;

        dados.cenas.forEach(function (cena, i) {
          // fundo: imagem borrada de ambiente + print nitido flutuando
          var shot = document.createElement('div');
          shot.className = 'case-shot' + (cena.phone ? ' is-phone' : '');

          /* Nem toda cena tem print — algumas existem so pelo texto (decisao
             de arquitetura, integracao). Sem esta guarda o <img> nascia com
             src="undefined" e o navegador pedia um arquivo inexistente,
             gerando 404 no console. */
          if (cena.img) {
            var blur = document.createElement('img');
            blur.className = 'blur';
            blur.src = cena.img;
            blur.alt = '';
            blur.setAttribute('aria-hidden', 'true');
            blur.loading = i === 0 ? 'eager' : 'lazy';
            blur.decoding = 'async';
            shot.appendChild(blur);

            var plate = document.createElement('div');
            plate.className = 'plate';
            var plate3d = document.createElement('div');
            plate3d.className = 'plate-3d';
            var img = document.createElement('img');
            img.src = cena.img;
            img.alt = cena.alt || '';
            img.loading = i === 0 ? 'eager' : 'lazy';
            img.decoding = 'async';
            plate3d.appendChild(img);
            plate.appendChild(plate3d);
            shot.appendChild(plate);
          } else {
            shot.classList.add('sem-print');
          }

          stage.appendChild(shot);
          shots.push(shot);

          // texto
          var scene = document.createElement('section');
          scene.className = 'case-scene' + (cena.capa ? ' cover' : '');
          var html = '<div class="case-copy">';
          if (cena.step) html += '<p class="step"><i></i>' + esc(cena.step) + '</p>';
          html += '<h3>' + esc(cena.titulo) + '</h3>';
          html += '<p>' + esc(cena.texto) + '</p>';
          if (cena.chips && cena.chips.length) {
            html += '<div class="case-chips">';
            cena.chips.forEach(function (c) { html += '<span>' + esc(c) + '</span>'; });
            html += '</div>';
          }
          if (cena.links && cena.links.length) {
            html += '<div class="case-links">';
            cena.links.forEach(function (l) {
              html += '<a class="' + (l.tipo === 'primary' ? 'primary' : 'ghost') + '" href="' + esc(l.href) +
                '" target="_blank" rel="noopener" data-cursor-label="Abrir">' + esc(l.label) + '</a>';
            });
            html += '</div>';
          }
          html += '</div>';
          scene.innerHTML = html;
          scenesWrap.appendChild(scene);
          scenes.push(scene);

          // indice lateral
          var dot = document.createElement('button');
          dot.type = 'button';
          dot.innerHTML = '<i></i>';
          dot.setAttribute('aria-label', 'Ir para a cena ' + (i + 1));
          dot.addEventListener('click', function () {
            scroller.scrollTo({ top: i * scroller.clientHeight, behavior: 'smooth' });
          });
          dotsWrap.appendChild(dot);
          dots.push(dot);
        });
      }

      function ativar(i) {
        if (i === atual || i < 0 || i >= shots.length) return;
        atual = i;
        shots.forEach(function (s, n) { s.classList.toggle('active', n === i); });
        scenes.forEach(function (s, n) { s.classList.toggle('in', n === i); });
        dots.forEach(function (d, n) { d.classList.toggle('on', n === i); });
        if (hint) hint.classList.toggle('show', i === 0 && shots.length > 1);
      }

      function onScroll() {
        var h = scroller.clientHeight || 1;
        // Limiar de 28% (nao 50% do Math.round): com meia tela de folga a
        // troca demorava ~450px de rolagem e dava sensacao de travamento.
        var bruto = scroller.scrollTop / h;
        var i = Math.floor(bruto + 0.72);
        if (i < 0) i = 0;
        if (i > shots.length - 1) i = shots.length - 1;
        ativar(i);
        if (progressBar) {
          var max = scroller.scrollHeight - h;
          var pct = max > 0 ? (scroller.scrollTop / max) * 100 : 0;
          progressBar.style.width = pct.toFixed(2) + '%';
        }
      }

      function abrir(chave) {
        var dados = CASES[chave];
        if (!dados) return;
        lastFocus = document.activeElement;
        montar(dados);
        overlay.hidden = false;
        // força reflow para a transicao de opacidade valer
        void overlay.offsetWidth;
        overlay.classList.add('open');
        document.body.classList.add('case-open');
        aberto = true;
        scroller.scrollTop = 0;
        ativar(0);
        onScroll();
        closeBtn.focus();
      }

      function fechar() {
        if (!aberto) return;
        aberto = false;
        overlay.classList.remove('open');
        document.body.classList.remove('case-open');
        window.setTimeout(function () {
          if (!aberto) {
            overlay.hidden = true;
            stage.innerHTML = '';
            scenesWrap.innerHTML = '';
            dotsWrap.innerHTML = '';
          }
        }, 520);
        if (lastFocus && lastFocus.focus) lastFocus.focus();
      }

      /* Inclinacao 3D do print seguindo o mouse — mesma linguagem do tilt
         dos cards da grade. Toque/telas grossas ficam de fora (nao ha hover)
         e quem pediu menos movimento tambem. */
      var semMovimento = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      var toque = window.matchMedia('(hover: none), (pointer: coarse)').matches;

      if (!semMovimento && !toque) {
        overlay.addEventListener('mousemove', function (e) {
          var alvo = shots[atual];
          if (!alvo) return;
          var p3d = alvo.querySelector('.plate-3d');
          if (!p3d) return;
          var px = (e.clientX / window.innerWidth) - 0.5;
          var py = (e.clientY / window.innerHeight) - 0.5;
          // -13deg de base: a placa nasce virada para o texto, como um
          // monitor apoiado na mesa e apontado para quem le
          p3d.style.transform =
            'rotateY(' + (-13 + px * 18) + 'deg) rotateX(' + (5 - py * 14) + 'deg) translateZ(0)';
        });
        overlay.addEventListener('mouseleave', function () {
          shots.forEach(function (s) {
            var p3d = s.querySelector('.plate-3d');
            if (p3d) p3d.style.transform = 'rotateY(-13deg) rotateX(5deg) translateZ(0)';
          });
        });
      }

      scroller.addEventListener('scroll', onScroll, { passive: true });
      closeBtn.addEventListener('click', fechar);
      document.addEventListener('keydown', function (e) {
        if (!aberto) return;
        if (e.key === 'Escape') { fechar(); return; }
        var h = scroller.clientHeight;
        if (e.key === 'ArrowDown' || e.key === 'PageDown') {
          e.preventDefault();
          scroller.scrollTo({ top: (atual + 1) * h, behavior: 'smooth' });
        } else if (e.key === 'ArrowUp' || e.key === 'PageUp') {
          e.preventDefault();
          scroller.scrollTo({ top: (atual - 1) * h, behavior: 'smooth' });
        }
      });
      window.addEventListener('resize', function () { if (aberto) onScroll(); });

      /* Liga os projetos ao overlay.
         Na landing o card inteiro é clicável (não há `.work-cover` nem o
         modal padrão do portfolio.html), então o ouvinte vai no próprio
         elemento que carrega o `data-case`. */
      document.querySelectorAll('[data-case]').forEach(function (card) {
        var chave = card.getAttribute('data-case');
        card.addEventListener('click', function (e) {
          /* deixa passar clique em link de verdade dentro do card */
          if (e.target.closest && e.target.closest('a[href]')) return;
          e.preventDefault();
          abrir(chave);
        });
        card.addEventListener('keydown', function (e) {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); abrir(chave); }
        });
      });
    })();

  /* ---------- Fundo vivo (shader WebGL) — massa de cor da capa ---------- */
    (function () {
      var canvas = document.getElementById('bgCanvas');
      if (!canvas) return;
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

      var gl = canvas.getContext('webgl', { alpha: false, antialias: false, depth: false })
            || canvas.getContext('experimental-webgl', { alpha: false });
      if (!gl) return;   /* sem WebGL: fundo solido do tema, sem quebrar nada */

      var VERT = [
        'attribute vec2 p;',
        'void main(){ gl_Position = vec4(p, 0.0, 1.0); }'
      ].join('\n');

      var FRAG = [
        'precision highp float;',
        'uniform vec2  uRes;',
        'uniform float uTime;',
        'uniform vec3  uBase;',   /* cor de fundo do tema */
        'uniform vec3  uCorA;',   /* turquesa da identidade */
        'uniform vec3  uCorB;',   /* azul da identidade */
        'uniform float uForca;',  /* quanto a cor cobre o fundo */
        'uniform float uCircuito;', /* 0 = so o fluido; 1 = trilhas no auge */
        'uniform vec3  uTrilha;',  /* cor das trilhas de circuito */

        /* ruido de valor + fBm — base da textura organica */
        'float hash(vec2 v){ return fract(sin(dot(v, vec2(127.1, 311.7))) * 43758.5453123); }',
        'float noise(vec2 v){',
        '  vec2 i = floor(v), f = fract(v);',
        '  float a = hash(i), b = hash(i + vec2(1.0, 0.0));',
        '  float c = hash(i + vec2(0.0, 1.0)), d = hash(i + vec2(1.0, 1.0));',
        '  vec2 u = f * f * (3.0 - 2.0 * f);',
        '  return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;',
        '}',
        'float fbm(vec2 v){',
        '  float s = 0.0, amp = 0.55;',
        '  for (int i = 0; i < 5; i++){',
        '    s += amp * noise(v);',
        '    v = v * 2.02 + vec2(37.1, 17.3);',
        '    amp *= 0.5;',
        '  }',
        '  return s;',
        '}',

        /* ---------- Trilhas de circuito ----------
           Desenho tecnico que emerge conforme o fundo escurece: uma grade de
           celulas onde cada celula sorteia UMA trilha (horizontal, vertical
           ou uma quina) e, as vezes, um no soldado no ponto de encontro.
           E o mesmo vocabulario visual de uma placa / diagrama de arquitetura
           — nao "chuva de Matrix", que seria o clichê obvio de programacao.

           Tudo sai do `hash` da celula: mesmo lugar, mesmo desenho sempre, o
           que evita cintilar entre quadros. So o pulso que corre pela trilha
           usa uTime. */
        'float trilhas(vec2 uv, float aspecto, float t){',
        /* Densidade e espessura calibradas para a resolucao REAL do canvas,
           que e menor que a tela: o buffer roda a ESCALA (0.4) e depois e
           esticado por CSS. Com grade fina (9.0) e trilha de 0.018 o desenho
           caia abaixo de 1 pixel no buffer e virava borrao ao esticar —
           invisivel no uso real, mesmo "existindo" no shader.
           Ao mexer aqui: conferir no CELULAR, nao so no desktop, porque e la
           que o buffer e menor (canvas ~156px de largura num viewport 390). */
        '  vec2 g = uv * vec2(aspecto, 1.0) * 5.0;',   /* grade mais larga */
        '  vec2 cel = floor(g);',
        '  vec2 f = fract(g) - 0.5;',                  /* -0.5..0.5 dentro da celula */
        '  float r = hash(cel);',
        '  float linha = 0.0;',
        '  float esp = 0.055;',                        /* espessura da trilha */

        /* ~35% das celulas ficam vazias: respiro, senao vira textura cheia */
        '  if (r < 0.35) return 0.0;',

        /* Fade nas duas extremidades da celula. Sem isso a trilha termina em
           corte reto na borda da celula — o traco "acaba do nada", com a
           ponta dura. Com o fade ela se dissolve, e o encontro entre celulas
           vizinhas tambem deixa de mostrar a emenda. A janela (0.5 -> 0.36)
           e curta de proposito: dissolve so a pontinha, sem afinar o traco
           inteiro. */
        '  float fadeX = smoothstep(0.5, 0.36, abs(f.x));',
        '  float fadeY = smoothstep(0.5, 0.36, abs(f.y));',

        '  if (r < 0.55) {',
        /* trilha horizontal — desvanece nas pontas esquerda/direita */
        '    linha = smoothstep(esp, 0.0, abs(f.y)) * fadeX;',
        '  } else if (r < 0.72) {',
        /* trilha vertical — desvanece nas pontas de cima/baixo */
        '    linha = smoothstep(esp, 0.0, abs(f.x)) * fadeY;',
        '  } else {',
        /* quina: dois bracos que se encontram no centro. O sentido da quina
           vem de outro hash, entao as viradas nao ficam todas iguais.

           O recorte de cada braco usa smoothstep, NAO step: o step corta de
           0 para 1 num pixel so, sem antialiasing, e a ponta do braco saia
           com a borda dura/serrilhada (a lateral era suave e a ponta nao —
           o contraste entre as duas era o que chamava atencao). A janela de
           `pta` faz a ponta desvanecer na mesma escala da espessura, entao
           o traco termina com o mesmo acabamento que tem de lado. */
        '    float s = hash(cel + 7.3) < 0.5 ? 1.0 : -1.0;',
        '    float pta = esp * 0.9;',
        /* cada braco recebe DOIS fades: `pta` dissolve a ponta interna (onde
           o braco morre no centro) e fadeX/fadeY dissolvem a externa (onde
           ele encosta na borda da celula) */
        '    float bx = smoothstep(esp, 0.0, abs(f.y)) * smoothstep(pta, -pta, f.x * s) * fadeX;',
        '    float by = smoothstep(esp, 0.0, abs(f.x)) * smoothstep(-pta, pta, f.y * s) * fadeY;',
        '    linha = max(bx, by);',
        /* no soldado na junta — cresce junto com a espessura da trilha */
        '    float no = smoothstep(0.135, 0.075, length(f));',
        '    linha = max(linha, no);',
        '  }',

        /* pulso: um brilho percorre a trilha, como sinal passando. Fase
           propria por celula para nao piscarem todas juntas. */
        '  float fase = hash(cel + 3.1) * 6.28;',
        '  float pulso = 0.55 + 0.45 * sin(t * 1.6 + fase + (f.x + f.y) * 3.0);',

        '  return linha * pulso;',
        '}',

        'void main(){',
        '  vec2 uv = gl_FragCoord.xy / uRes.xy;',
        '  vec2 q = uv * vec2(uRes.x / uRes.y, 1.0) * 1.6;',
        '  float t = uTime * 0.055;',

        /* domain warping: o ruido distorce as proprias coordenadas, o que
           produz o aspecto de fluido em vez de manchas estaticas */
        '  vec2 w1 = vec2(fbm(q + vec2(0.0, t)), fbm(q + vec2(5.2, 1.3 - t)));',
        '  vec2 w2 = vec2(fbm(q + 3.4 * w1 + vec2(1.7, 9.2) + 0.6 * t),',
        '                 fbm(q + 3.4 * w1 + vec2(8.3, 2.8) - 0.4 * t));',
        '  float n = fbm(q + 3.0 * w2);',

        /* duas massas de cor com distribuicao diferente na tela */
        '  float mA = smoothstep(0.32, 0.92, n) * smoothstep(1.15, 0.15, uv.x + n * 0.35);',
        '  float mB = smoothstep(0.38, 0.95, 1.0 - n) * smoothstep(-0.15, 0.95, uv.x - n * 0.25);',

        '  vec3 cor = uBase;',
        '  cor = mix(cor, uCorA, clamp(mA * uForca, 0.0, 1.0));',
        '  cor = mix(cor, uCorB, clamp(mB * uForca * 0.9, 0.0, 1.0));',

        /* circuito por cima do fluido, so quando uCircuito sobe (ou seja, a
           medida que a pagina escurece). O proprio ruido `n` modula a
           intensidade: as trilhas somem dentro das massas de cor e aparecem
           nas areas calmas, o que evita a leitura de "grade colada por cima"
           e faz o desenho parecer parte do mesmo material. */
        '  float c = trilhas(uv, uRes.x / uRes.y, uTime);',
        /* a modulacao pelo ruido continua, mas com piso alto (0.7): antes ia
           a 0.35 e apagava o desenho justamente nas areas de cor, que e onde
           o olho estava procurando */
        '  c *= uCircuito * (0.7 + 0.3 * smoothstep(0.75, 0.25, n));',
        '  cor += uTrilha * c;',

        /* grao: tira o aspecto plastico do degrade */
        '  float g = hash(gl_FragCoord.xy + uTime) - 0.5;',
        '  cor += g * 0.022;',

        '  gl_FragColor = vec4(cor, 1.0);',
        '}'
      ].join('\n');

      function compilar(tipo, src) {
        var s = gl.createShader(tipo);
        gl.shaderSource(s, src);
        gl.compileShader(s);
        if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) return null;
        return s;
      }

      var vs = compilar(gl.VERTEX_SHADER, VERT);
      var fs = compilar(gl.FRAGMENT_SHADER, FRAG);
      if (!vs || !fs) return;

      var prog = gl.createProgram();
      gl.attachShader(prog, vs);
      gl.attachShader(prog, fs);
      gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return;
      gl.useProgram(prog);

      /* dois triangulos cobrindo a tela */
      var buf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 3,-1, -1,3]), gl.STATIC_DRAW);
      var loc = gl.getAttribLocation(prog, 'p');
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

      var uRes   = gl.getUniformLocation(prog, 'uRes');
      var uTime  = gl.getUniformLocation(prog, 'uTime');
      var uBase  = gl.getUniformLocation(prog, 'uBase');
      var uCorA  = gl.getUniformLocation(prog, 'uCorA');
      var uCorB  = gl.getUniformLocation(prog, 'uCorB');
      var uForca = gl.getUniformLocation(prog, 'uForca');
      var uCircuito = gl.getUniformLocation(prog, 'uCircuito');
      var uTrilha = gl.getUniformLocation(prog, 'uTrilha');

      /* O canvas roda numa fracao da tela e e esticado por CSS (o fluido e
         suave, entao ninguem nota). 0.4 bastava quando o fundo era so
         degrade, mas as trilhas de circuito sao linhas finas: nessa escala
         elas caiam abaixo de 1px no buffer e sumiam ao esticar. 0.6 e o
         meio-termo — desenho legivel sem devolver o custo cheio de pintar
         a tela inteira a cada quadro. */
      var ESCALA = 0.6;
      function medir() {
        canvas.width  = Math.max(1, Math.round(window.innerWidth  * ESCALA));
        canvas.height = Math.max(1, Math.round(window.innerHeight * ESCALA));
        gl.viewport(0, 0, canvas.width, canvas.height);
      }
      medir();

      var claro = true;
      function lerTema() {
        /* A landing usa `data-tema` com claro/escuro; o shader veio do
           portfolio.html, que usava `data-theme` com light/dark. Sem esta
           tradução o fundo ficava sempre na paleta clara — inclusive no
           modo escuro, que era o sintoma visível. */
        var attr = document.documentElement.getAttribute('data-tema');
        claro = attr ? attr === 'claro'
                     : !window.matchMedia('(prefers-color-scheme: dark)').matches;
      }
      lerTema();

      var t0 = Date.now();
      var timer = null;

      /* ---------- Escurecimento progressivo no scroll ----------
         A cor nao muda: e sempre a turquesa/azul da identidade. O que muda e
         a LUZ — a pagina fecha um pouco conforme a pessoa desce.

         Historico, para nao refazer o que ja foi descartado:
         1. Paleta por secao (violeta na IA, ambar no audiovisual) — o fundo
            mudava de cor e competia com o conteudo. Descartado.
         2. Primeira versao deste escurecimento — ia longe demais (o rodape
            do tema claro virava cinza medio) e derrubava o contraste do
            texto. Descartado por isso.

         Esta versao existe porque o efeito em si e bom; o problema era a
         DOSE. O teto de cada tema abaixo foi definido medindo o contraste do
         rodape (o ponto mais escuro da pagina, com o texto mais fraco), nao
         a olho. */

      /* Cores da identidade — as mesmas que o site sempre teve. */
      var COR_CLARO  = { a: [0.106,0.780,0.690], b: [0.145,0.420,0.900], f: 0.62 };
      var COR_ESCURO = { a: [0.184,0.878,0.784], b: [0.231,0.510,0.965], f: 0.55 };

      /* Base de cada tema — o #F3F5F4 / #08090B do CSS. */
      var BASE_CLARO  = [0.953, 0.961, 0.957];
      var BASE_ESCURO = [0.031, 0.035, 0.043];

      /* Para onde a base caminha ao escurecer. NAO e preto: no tema claro o
         alvo e um cinza-azulado ainda claro, senao o texto escuro do site
         perde apoio (foi o erro da primeira versao). No escuro pode ir mais
         fundo, porque la o texto e claro e ganha contraste ao escurecer. */
      var ALVO_CLARO  = [0.780, 0.800, 0.812];
      var ALVO_ESCURO = [0.012, 0.014, 0.019];

      /* Teto do escurecimento, por tema — quanto da distancia ate o alvo a
         pagina percorre do topo ao rodape. Medido, nao estimado: com o valor
         do tema claro acima de ~0.55 o contraste do rodape cai abaixo dos
         4.5:1 exigidos por WCAG AA. Ao mexer, medir de novo. */
      var ESCURECE_MAX_CLARO  = 0.5;
      var ESCURECE_MAX_ESCURO = 0.85;

      /* Intensidade do circuito NO AUGE — no rodape, com a pagina ja fechada.
         As trilhas acompanham o escurecimento (ver uCircuito em quadro()):
         a pagina abre limpa, so com o fluido, e o desenho vai surgindo
         conforme a pessoa desce. Acima de ~0.75 as trilhas comecam a
         disputar atencao com o texto em vez de ficarem no fundo. */
      var CIRCUITO_MAX = 0.62;

      /* progresso do scroll: 0 no topo da pagina, 1 no fim */
      function progressoScroll() {
        var alcance = document.documentElement.scrollHeight - window.innerHeight;
        if (alcance <= 0) return 0;
        var p = window.scrollY / alcance;
        return p < 0 ? 0 : (p > 1 ? 1 : p);
      }

      var escuroAtual = 0, escuroAlvo = 0;

      function lerAlvo() {
        /* curva suave: o topo segura a luz por mais tempo e o fechamento
           acontece no miolo, em vez de escurecer desde o primeiro pixel */
        var p = progressoScroll();
        escuroAlvo = p * p * (3.0 - 2.0 * p);
      }
      lerAlvo();
      escuroAtual = escuroAlvo;   /* sem fade no load: ja comeca no lugar */

      /* aproxima o valor atual do alvo a cada quadro — e isso que faz a
         mudanca ser um fade percebido, e nao o fundo colado no scroll */
      function misturar() {
        escuroAtual += (escuroAlvo - escuroAtual) * 0.06;
      }

      window.addEventListener('scroll', lerAlvo, { passive: true });
      window.addEventListener('resize', lerAlvo, { passive: true });

      function quadro() {
        gl.uniform2f(uRes, canvas.width, canvas.height);
        gl.uniform1f(uTime, (Date.now() - t0) / 1000);

        misturar();

        var paleta = claro ? COR_CLARO : COR_ESCURO;
        var base   = claro ? BASE_CLARO : BASE_ESCURO;
        var alvo   = claro ? ALVO_CLARO : ALVO_ESCURO;
        var k = escuroAtual * (claro ? ESCURECE_MAX_CLARO : ESCURECE_MAX_ESCURO);

        /* a base caminha em direcao ao alvo escuro do tema */
        gl.uniform3f(uBase,
          base[0] + (alvo[0] - base[0]) * k,
          base[1] + (alvo[1] - base[1]) * k,
          base[2] + (alvo[2] - base[2]) * k);

        /* As cores acompanham, senao ficariam boiando acesas sobre um fundo
           apagado (vira neon, nao anoitecer).

           O fator e maior no tema escuro por causa do `mix-blend-mode:
           screen` do canvas: sob screen o resultado final e dominado pela
           COR (a base quase preta contribui pouco), entao baixar so a base
           nao escurece nada — chegava a clarear, porque as manchas de cor
           continuavam fortes sobre um fundo que ja era escuro. Puxar a cor
           para baixo e o que de fato fecha a tela nesse tema. */
        var kc = 1.0 - k * (claro ? 0.42 : 0.72);
        gl.uniform3f(uCorA, paleta.a[0] * kc, paleta.a[1] * kc, paleta.a[2] * kc);
        gl.uniform3f(uCorB, paleta.b[0] * kc, paleta.b[1] * kc, paleta.b[2] * kc);
        gl.uniform1f(uForca, paleta.f);

        /* As trilhas surgem junto com o escurecimento: invisiveis no topo
           (a pagina abre limpa) e no auge la embaixo, onde o fundo ja esta
           fechado e aguenta o desenho sem competir com o texto. Usa
           `escuroAtual` — e nao o progresso cru do scroll — para o circuito
           entrar no mesmo fade suave do resto, em vez de colar no scroll. */
        gl.uniform1f(uCircuito, escuroAtual * CIRCUITO_MAX);

        /* A trilha SEMPRE escurece (valor negativo), nos dois temas.

           No tema escuro o canvas usa `mix-blend-mode: screen` (ver o CSS de
           #bgCanvas). O screen clareia — resultado = 1-(1-a)(1-b) — entao
           trilha clara sobre fundo que ja tem cor e matematicamente engolida:
           o desenho rodava, os uniforms chegavam certos, e nada aparecia na
           tela. Escurecer cria contraste que o screen preserva, e o resultado
           le como trilha vazada no material (que e o que se quer de uma
           placa de circuito). */
        if (claro) {
          gl.uniform3f(uTrilha, -0.42, -0.36, -0.38);
        } else {
          /* No escuro a trilha precisa de reforco a medida que a pagina
             fecha: o `kc` acima derruba as cores em ate 72%, e a trilha
             escura fica sem material de onde "vazar" — o desenho sumia
             justamente no rodape, que e onde deveria estar no auge. O ganho
             abaixo devolve o contraste na mesma proporcao em que a cor cai. */
          var reforco = 1.0 + k * 1.9;
          gl.uniform3f(uTrilha, -0.10 * reforco, -0.26 * reforco, -0.24 * reforco);
        }

        gl.drawArrays(gl.TRIANGLES, 0, 3);
      }

      /* Dois motivos independentes para o fundo parar: a aba ficou oculta, ou
         o hero saiu da tela. Guardar cada um em sua propria variavel evita o
         bug classico de um reativar o que o outro desligou — o loop so roda
         quando NENHUM dos dois pede pausa. */
      var pausadoPorAba = false;
      var pausadoPorScroll = false;

      function sincronizar() {
        var deveRodar = !pausadoPorAba && !pausadoPorScroll;
        if (deveRodar && !timer) {
          timer = window.setInterval(quadro, 1000 / 30);
        } else if (!deveRodar && timer) {
          window.clearInterval(timer);
          timer = null;
        }
      }

      window.addEventListener('resize', function () { medir(); quadro(); });
      document.addEventListener('visibilitychange', function () {
        pausadoPorAba = document.hidden;
        sincronizar();
      });

      /* O fundo agora vive dentro do hero, entao rodar o shader depois que ele
         saiu da tela e desenhar o que ninguem ve. Este observer e o que de
         fato devolve a GPU durante a leitura do conteudo.
         Ele so PAUSA o loop — nunca esconde nada, nem toca no conteudo da
         pagina (ver a regra de ouro do motor de scroll mais abaixo). Sem
         IntersectionObserver, o fundo simplesmente segue rodando como antes. */
      if (window.IntersectionObserver) {
        var palco = document.querySelector('.bg-stage');
        if (palco) {
          new IntersectionObserver(function (entradas) {
            pausadoPorScroll = !entradas[0].isIntersecting;
            sincronizar();
          }).observe(palco);
        }
      }
      /* trocar o tema troca paleta, teto de escurecimento e cor da trilha —
         o quadro() aqui repinta na hora, sem esperar o proximo tick */
      var obs = new MutationObserver(function () { lerTema(); lerAlvo(); quadro(); });
      obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-tema'] });

      quadro();
      document.documentElement.classList.add('bg-vivo');
      sincronizar();
    })();

  /* ---------- Modal de vídeo dos cards audiovisuais ----------
     Migrado do portfolio.html. Cada .work-card declara o embed em
     `data-modal-embed`; múltiplos vídeos vêm separados por "|" e viram
     botões de seleção na .modal-video-list. Overlay independente do
     #caseOverlay e do #skillModalBackdrop — não compartilha estado. */
  (function () {
    var backdrop = document.getElementById('modalBackdrop');
    var titulo = document.getElementById('modalTitle');
    var desc = document.getElementById('modalDesc');
    var meta = document.getElementById('modalMeta');
    var quadro = document.getElementById('modalFrame');
    var lista = document.getElementById('modalVideoList');
    var fechar = document.getElementById('modalClose');
    if (!backdrop || !quadro) return;

    function mostrarEmbed(url) {
      quadro.innerHTML = '';
      var caixa = document.createElement('div');
      caixa.className = 'embed-box';
      if (/\.mp4($|\?)/i.test(url)) {
        var video = document.createElement('video');
        video.src = url;
        video.controls = true;
        video.playsInline = true;
        caixa.appendChild(video);
      } else {
        var iframe = document.createElement('iframe');
        iframe.src = url;
        iframe.allow = 'autoplay; fullscreen';
        iframe.allowFullscreen = true;
        iframe.setAttribute('title', titulo.textContent || 'Vídeo do trabalho');
        caixa.appendChild(iframe);
      }
      quadro.appendChild(caixa);
    }

    /* Esvaziar o quadro é o que interrompe o áudio: sem isso o iframe
       continua tocando atrás do overlay fechado. */
    function fecharModal() {
      if (!backdrop.classList.contains('open')) return;
      quadro.innerHTML = '';
      lista.innerHTML = '';
      backdrop.classList.remove('open');
      document.body.classList.remove('modal-open');
    }

    function abrirModal(card) {
      titulo.textContent = card.getAttribute('data-modal-title') || '';
      desc.textContent = card.getAttribute('data-modal-desc') || '';
      meta.textContent = card.getAttribute('data-modal-meta') || '';
      lista.innerHTML = '';

      var embed = card.getAttribute('data-modal-embed');
      if (embed) {
        var urls = embed.split('|');
        mostrarEmbed(urls[0]);
        if (urls.length > 1) {
          urls.forEach(function (url, i) {
            var b = document.createElement('button');
            b.type = 'button';
            b.textContent = 'Vídeo ' + (i + 1);
            if (i === 0) b.classList.add('active');
            b.addEventListener('click', function () {
              mostrarEmbed(url);
              lista.querySelectorAll('button').forEach(function (o) { o.classList.remove('active'); });
              b.classList.add('active');
            });
            lista.appendChild(b);
          });
        }
      } else {
        quadro.textContent = 'Este trabalho não tem vídeo associado — veja os links abaixo.';
      }

      backdrop.classList.add('open');
      document.body.classList.add('modal-open');
      fechar.focus();
    }

    document.querySelectorAll('.work-card').forEach(function (card) {
      var capa = card.querySelector('.work-cover');
      if (!capa) return;
      capa.setAttribute('role', 'button');
      capa.setAttribute('tabindex', '0');
      capa.setAttribute('aria-label', 'Ver ' + (card.getAttribute('data-modal-title') || 'trabalho'));
      capa.addEventListener('click', function () { abrirModal(card); });
      capa.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); abrirModal(card); }
      });
    });

    fechar.addEventListener('click', fecharModal);
    backdrop.addEventListener('click', function (e) { if (e.target === backdrop) fecharModal(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') fecharModal(); });
  })();

  /* ---------- Painel da ferramenta (logo + cor + descrição) ---------- */
  (function () {
    var skillModalBackdrop = document.getElementById('skillModalBackdrop');
    var skillModalBadge = document.getElementById('skillModalBadge');
    var skillModalMark = document.getElementById('skillModalMark');
    var skillModalName = document.getElementById('skillModalName');
    var skillModalDesc = document.getElementById('skillModalDesc');
    var skillModalClose = document.getElementById('skillModalClose');

    function openSkillModal(box) {
      var iconSrc = box.getAttribute('data-skill-icon');
      var isMono = box.getAttribute('data-skill-icon-mono') === '1';
      var isWide = box.getAttribute('data-skill-icon-wide') === '1';
      var isPhoto = box.getAttribute('data-skill-icon-photo') === '1';
      skillModalBadge.style.setProperty('--skill-color', box.getAttribute('data-skill-color') || '');
      skillModalBadge.classList.toggle('has-icon', !!iconSrc);
      skillModalBadge.classList.toggle('icon-mono', !!iconSrc && isMono);
      skillModalBadge.classList.toggle('icon-wide', !!iconSrc && isWide);
      skillModalBadge.classList.toggle('icon-photo', !!iconSrc && isPhoto);
      skillModalBadge.innerHTML = iconSrc
        ? '<img src="' + iconSrc + '" alt="" loading="lazy">'
        : '<span id="skillModalMark"></span>';
      if (!iconSrc) {
        skillModalMark = document.getElementById('skillModalMark');
        skillModalMark.textContent = box.getAttribute('data-skill-mark') || '';
      }
      skillModalName.textContent = box.getAttribute('data-skill-name') || '';
      skillModalDesc.textContent = box.getAttribute('data-skill-desc') || '';
      skillModalBackdrop.classList.add('open');
      document.body.classList.add('modal-open');
    }
    function closeSkillModal() {
      skillModalBackdrop.classList.remove('open');
      document.body.classList.remove('modal-open');
    }

    document.querySelectorAll('.skill-box').forEach(function (box) {
      box.addEventListener('click', function () { openSkillModal(box); });
      box.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openSkillModal(box); }
      });
    });
    skillModalClose.addEventListener('click', closeSkillModal);
    skillModalBackdrop.addEventListener('click', function (e) { if (e.target === skillModalBackdrop) closeSkillModal(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeSkillModal(); });
  })();

  /* imagens que chegam depois mudam a altura da página; sem isto os
     gatilhos ficam calculados sobre medidas velhas */
  window.addEventListener('load', function () { ScrollTrigger.refresh(); });
})();
