(function () {
  'use strict';
  const Q = window.QUIZ;
  const $ = (id) => document.getElementById(id);
  const fmt = (n) => Math.round(n).toLocaleString('pt-BR');

  // ---------- Identificadores anônimos ----------
  function randomId() {
    const b = new Uint8Array(16);
    crypto.getRandomValues(b);
    return Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
  }
  function visitorId() {
    try {
      let v = localStorage.getItem('gota_vid');
      if (!v) localStorage.setItem('gota_vid', (v = randomId()));
      return v;
    } catch {
      return randomId();
    }
  }
  // Chama uma função do banco (ver supabase/schema.sql)
  function rpc(fn, args) {
    if (!window.GotaDB) return Promise.reject(new Error('Banco de dados não configurado'));
    return window.GotaDB.rpc(fn, args).then(({ error }) => {
      if (error) throw new Error(error.message || 'Erro de conexão');
    });
  }

  rpc('registrar_acesso', { p_visitante: visitorId() }).catch((e) => console.warn(e.message));

  // ---------- Estado ----------
  let sessionId = null;
  let respostas = [];
  let atual = 0;
  let avancando = false;
  let inicio = Promise.resolve(); // garante a ordem: iniciar → concluir → avaliar
  let conclusao = Promise.resolve();

  function mostrar(tela) {
    document.querySelectorAll('.tela').forEach((t) => t.classList.toggle('ativa', t.id === tela));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function iniciar() {
    sessionId = randomId();
    respostas = new Array(Q.perguntas.length).fill(null);
    atual = 0;
    inicio = rpc('iniciar_quiz', { p_sessao: sessionId }).catch((e) => console.warn(e.message));
    renderPergunta();
    mostrar('tela-pergunta');
  }

  // ---------- Perguntas ----------
  function renderPergunta() {
    const p = Q.perguntas[atual];
    const n = Q.perguntas.length;
    $('contador').textContent = `Pergunta ${atual + 1} de ${n}`;
    $('barra').style.width = `${(atual / n) * 100}%`;
    $('barra').parentElement.setAttribute('aria-valuenow', Math.round((atual / n) * 100));
    $('btn-voltar').style.visibility = atual === 0 ? 'hidden' : 'visible';
    $('p-icone').textContent = p.icone;
    $('p-texto').textContent = p.pergunta;
    $('p-reflexao').textContent = p.reflexao;

    const box = $('p-opcoes');
    box.innerHTML = '';
    box.setAttribute('aria-labelledby', 'p-texto');
    p.opcoes.forEach((o, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'opcao';
      b.setAttribute('role', 'radio');
      b.setAttribute('aria-checked', String(respostas[atual] === i));
      b.innerHTML = '<span class="marca"></span><span></span>';
      b.lastChild.textContent = o.t;
      b.addEventListener('click', () => escolher(i));
      box.appendChild(b);
    });
    const card = document.querySelector('#tela-pergunta .cartao');
    card.style.animation = 'none';
    void card.offsetWidth;
    card.style.animation = 'entra .3s ease';
  }

  function escolher(i) {
    if (avancando) return;
    avancando = true;
    respostas[atual] = i;
    $('p-opcoes').querySelectorAll('.opcao').forEach((b, j) => b.setAttribute('aria-checked', String(j === i)));
    setTimeout(() => {
      avancando = false;
      if (atual < Q.perguntas.length - 1) {
        atual++;
        renderPergunta();
      } else {
        finalizar();
      }
    }, 280);
  }

  function voltar() {
    if (atual > 0) {
      atual--;
      renderPergunta();
    }
  }

  // ---------- Resultado ----------
  function finalizar() {
    const r = Q.calcular(respostas);
    $('barra').style.width = '100%';
    const sid = sessionId;
    const resp = respostas.slice();
    conclusao = inicio.then(() => rpc('concluir_quiz', { p_sessao: sid, p_respostas: resp }));
    conclusao.catch((e) => console.warn(e.message));
    renderResultado(r);
    mostrar('tela-resultado');
  }

  function nivel(total) {
    const { onu, brasil } = Q.referencias;
    if (total <= onu) return ['bom', 'Consumo consciente 🌱'];
    if (total <= brasil) return ['medio', 'Dá para melhorar 💡'];
    if (total <= 250) return ['alto', 'Consumo alto ⚠️'];
    return ['alto', 'Consumo muito alto 🚨'];
  }

  function renderResultado(r) {
    const total = r.total;
    const { onu, brasil } = Q.referencias;
    const [cls, txt] = nivel(total);
    $('r-nivel').className = 'nivel ' + cls;
    $('r-nivel').textContent = txt;

    const diffOnu = total - onu;
    $('r-comparacao').textContent =
      diffOnu <= 0
        ? `Você está dentro dos ${onu} L/dia que a ONU considera suficientes para uma pessoa. Parabéns!`
        : `São ${fmt(diffOnu)} litros a mais que os ${onu} L/dia recomendados pela ONU. A média no Brasil é de cerca de ${brasil} L.`;

    // Tanque
    const escala = Math.max(300, total * 1.15);
    const yDe = (l) => 240 - 220 * Math.min(1, l / escala);
    const refs = $('refs');
    refs.innerHTML = '';
    [
      [onu, `ONU ${onu} L`],
      [brasil, `Brasil ${brasil} L`],
    ].forEach(([l, rot]) => {
      const y = yDe(l);
      refs.insertAdjacentHTML(
        'beforeend',
        `<line class="ref-linha" x1="12" x2="148" y1="${y}" y2="${y}"/><text class="ref-txt" x="26" y="${y - 4}">${rot}</text>`
      );
    });
    $('tanque-desc').textContent = `Tanque com ${total} litros, comparado à referência da ONU (${onu} L) e à média brasileira (${brasil} L).`;
    animar(1600, (k) => {
      $('agua').setAttribute('transform', `translate(0,${240 - (240 - yDe(total)) * k - 6})`);
      $('r-litros').textContent = fmt(total * k);
    });

    // Galões de 20 L
    const galoes = total / 20;
    const max = 40;
    const mostrados = Math.min(Math.ceil(galoes), max);
    $('r-galoes-txt').innerHTML = '';
    $('r-galoes-txt').append(
      'Por dia, isso equivale a ',
      Object.assign(document.createElement('strong'), {
        textContent: `${galoes.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} galões de 20 L`,
      }),
      ' — como os de água mineral.' + (Math.ceil(galoes) > max ? ` (mostrando ${max})` : '')
    );
    const g = $('r-galoes');
    g.innerHTML = '';
    for (let i = 0; i < mostrados; i++) {
      const frac = Math.min(1, galoes - i);
      const h = 26 * frac;
      g.insertAdjacentHTML(
        'beforeend',
        `<svg viewBox="0 0 30 40"><rect x="11" y="1" width="8" height="5" rx="1" class="galao-corpo"/><rect x="3" y="6" width="24" height="32" rx="6" class="galao-corpo"/><rect x="6" y="${35 - h}" width="18" height="${h}" rx="3" class="galao-agua" style="opacity:0;transition:opacity .3s ${i * 40}ms"/></svg>`
      );
    }
    requestAnimationFrame(() => g.querySelectorAll('.galao-agua').forEach((el) => (el.style.opacity = '1')));

    // Mês / ano
    $('r-mes').textContent = fmt(total * 30);
    $('r-mes-eq').textContent = `≈ ${fmt((total * 30) / 500)} caixas d'água de 500 L`;
    $('r-ano').textContent = fmt(total * 365);
    $('r-ano-eq').textContent = `≈ ${fmt((total * 365) / 1000)} caixas d'água de 1.000 L`;

    // Barras por atividade
    const itens = r.itens.filter((it) => it.litros !== 0).sort((a, b) => b.litros - a.litros);
    const maior = Math.max(1, ...itens.map((it) => Math.abs(it.litros)));
    const barras = $('r-barras');
    barras.innerHTML = '';
    itens.forEach((it) => {
      const linha = document.createElement('div');
      linha.className = 'barra-linha' + (it.litros < 0 ? ' economia' : '');
      linha.innerHTML = '<span class="barra-rot"></span><div class="barra-trilho"><span></span></div><span class="barra-valor"></span>';
      linha.querySelector('.barra-rot').textContent = `${it.icone} ${it.rotulo}`;
      linha.querySelector('.barra-valor').textContent = it.litros < 0 ? `−${fmt(-it.litros)} L` : `${fmt(it.litros)} L`;
      barras.appendChild(linha);
      requestAnimationFrame(() =>
        requestAnimationFrame(() => (linha.querySelector('.barra-trilho span').style.width = `${(Math.abs(it.litros) / maior) * 100}%`))
      );
    });

    // Dicas (as 4 atividades com maior potencial)
    const dicas = r.itens.filter((it) => it.podeMelhorar).sort((a, b) => b.litros - a.litros).slice(0, 4);
    $('r-dicas-box').hidden = dicas.length === 0;
    const ul = $('r-dicas');
    ul.innerHTML = '';
    dicas.forEach((it) => {
      const li = document.createElement('li');
      li.innerHTML = '<span aria-hidden="true"></span><div><strong></strong><span></span></div>';
      li.firstChild.textContent = it.icone;
      li.querySelector('strong').textContent = it.rotulo;
      li.querySelector('div span').textContent = it.dica;
      ul.appendChild(li);
    });

    // Reset do feedback
    notaEscolhida = null;
    renderNps();
    $('sugestao').value = '';
    $('btn-enviar').disabled = true;
    $('fb-erro').hidden = true;
    $('form-feedback').hidden = false;
    $('obrigado').hidden = true;
  }

  function animar(dur, fn) {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return fn(1);
    const t0 = performance.now();
    const passo = (t) => {
      const p = Math.min(1, (t - t0) / dur);
      fn(1 - Math.pow(1 - p, 3));
      if (p < 1) requestAnimationFrame(passo);
    };
    requestAnimationFrame(passo);
  }

  // ---------- Feedback (nota 0–5 + sugestão) ----------
  let notaEscolhida = null;
  function renderNps() {
    const box = $('nps');
    box.innerHTML = '';
    box.setAttribute('role', 'radiogroup');
    for (let i = 0; i <= 5; i++) {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = i;
      b.setAttribute('role', 'radio');
      b.setAttribute('aria-label', `Nota ${i}`);
      b.setAttribute('aria-checked', String(notaEscolhida === i));
      b.addEventListener('click', () => {
        notaEscolhida = i;
        box.querySelectorAll('button').forEach((x, j) => x.setAttribute('aria-checked', String(j === i)));
        $('btn-enviar').disabled = false;
      });
      box.appendChild(b);
    }
  }

  $('form-feedback').addEventListener('submit', (e) => {
    e.preventDefault();
    if (notaEscolhida === null) return;
    const btn = $('btn-enviar');
    btn.disabled = true;
    btn.textContent = 'Enviando…';
    const args = { p_sessao: sessionId, p_nota: notaEscolhida, p_sugestao: $('sugestao').value };
    conclusao
      .then(() => rpc('enviar_avaliacao', args))
      .then(() => {
        $('form-feedback').hidden = true;
        $('obrigado').hidden = false;
      })
      .catch((err) => {
        $('fb-erro').textContent = err.message + '. Tente novamente.';
        $('fb-erro').hidden = false;
        btn.disabled = false;
      })
      .finally(() => (btn.textContent = 'Enviar avaliação'));
  });

  // ---------- Ações ----------
  $('btn-comecar').addEventListener('click', iniciar);
  $('btn-voltar').addEventListener('click', voltar);
  $('btn-refazer').addEventListener('click', iniciar);
  $('btn-compartilhar').addEventListener('click', async () => {
    const dados = {
      title: 'Gota a Gota',
      text: 'Descubra quanta água você usa por dia com este quiz rápido e anônimo 💧',
      url: new URL('./', location.href).href,
    };
    try {
      if (navigator.share) return await navigator.share(dados);
      await navigator.clipboard.writeText(dados.url);
      $('btn-compartilhar').textContent = 'Link copiado!';
      setTimeout(() => ($('btn-compartilhar').textContent = 'Compartilhar'), 2000);
    } catch {
      /* usuário cancelou */
    }
  });
  document.addEventListener('keydown', (e) => {
    if (!$('tela-pergunta').classList.contains('ativa')) return;
    const n = parseInt(e.key, 10);
    if (n >= 1 && n <= Q.perguntas[atual].opcoes.length) escolher(n - 1);
  });
})();
