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

  /* imagens que chegam depois mudam a altura da página; sem isto os
     gatilhos ficam calculados sobre medidas velhas */
  window.addEventListener('load', function () { ScrollTrigger.refresh(); });
})();
