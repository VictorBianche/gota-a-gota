(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const fmt = (n) => Math.round(n).toLocaleString('pt-BR');
  const data = (t) => new Date(t).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
  const Q = window.QUIZ;
  const sb = window.GotaDB;

  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  }

  function mostrarLogin(msg) {
    $('painel').hidden = true;
    $('tela-login').hidden = false;
    $('login-erro').hidden = !msg;
    $('login-erro').textContent = msg || '';
    $('email').focus();
  }

  // ---------- Dados ----------
  async function buscarRespostas() {
    const linhas = [];
    const passo = 1000;
    for (let de = 0; ; de += passo) {
      const { data: d, error } = await sb
        .from('respostas')
        .select('iniciado_em,concluido_em,respostas,nota,sugestao,avaliado_em')
        .order('iniciado_em')
        .range(de, de + passo - 1);
      if (error) throw error;
      linhas.push(...d);
      if (d.length < passo) return linhas;
    }
  }

  const ms = (t) => (t ? new Date(t).getTime() : null);
  const diaLocal = (d) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  function montarStats(linhas, acessos) {
    const done = linhas
      .filter((r) => r.concluido_em && Array.isArray(r.respostas))
      .map((r) => ({ ...r, total: (Q.calcular(r.respostas) || { total: 0 }).total, t: ms(r.concluido_em) }));
    const totals = done.map((s) => s.total).sort((a, b) => a - b);
    const comNota = done.filter((s) => Number.isInteger(s.nota));

    const porDia = [];
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    for (let i = 29; i >= 0; i--) {
      const d = new Date(hoje);
      d.setDate(d.getDate() - i);
      porDia.push({ dia: diaLocal(d), acessos: 0, concluidos: 0 });
    }
    const idx = Object.fromEntries(porDia.map((d, i) => [d.dia, i]));
    for (const a of acessos.por_dia || []) if (idx[a.dia] !== undefined) porDia[idx[a.dia]].acessos = a.acessos;
    for (const s of done) {
      const i = idx[diaLocal(new Date(s.t))];
      if (i !== undefined) porDia[i].concluidos++;
    }

    const limites = [110, 150, 250, 400, Infinity];
    const faixas = ['Até 110 L', '111–150 L', '151–250 L', '251–400 L', 'Mais de 400 L'].map((rotulo) => ({ rotulo, qtd: 0 }));
    for (const t of totals) faixas[limites.findIndex((lim) => t <= lim)].qtd++;

    const perguntas = Q.perguntas.map((p, qi) => {
      const counts = p.opcoes.map(() => 0);
      let soma = 0;
      for (const s of done) {
        const o = s.respostas[qi];
        if (counts[o] !== undefined) {
          counts[o]++;
          soma += p.opcoes[o].l;
        }
      }
      return {
        id: p.id, rotulo: p.rotulo, icone: p.icone, pergunta: p.pergunta,
        mediaLitros: done.length ? Math.round(soma / done.length) : 0,
        opcoes: p.opcoes.map((o, i) => ({ texto: o.t, litros: o.l, qtd: counts[i] })),
      };
    });

    const dist = [0, 0, 0, 0, 0, 0];
    for (const s of comNota) dist[s.nota]++;
    const n = totals.length;
    const mediana = !n ? 0 : n % 2 ? totals[(n - 1) / 2] : Math.round((totals[n / 2 - 1] + totals[n / 2]) / 2);

    return {
      geradoEm: Date.now(),
      acessos: acessos.total || 0,
      visitantesUnicos: acessos.unicos || 0,
      iniciados: linhas.length,
      concluidos: done.length,
      feedbacks: comNota.length,
      mediaLitros: n ? Math.round(totals.reduce((a, b) => a + b, 0) / n) : 0,
      medianaLitros: mediana,
      minLitros: totals[0] || 0,
      maxLitros: totals[n - 1] || 0,
      porDia,
      faixas,
      perguntas,
      nps: { media: comNota.length ? +(comNota.reduce((a, s) => a + s.nota, 0) / comNota.length).toFixed(2) : null, distribuicao: dist },
      sugestoes: done
        .filter((s) => s.sugestao)
        .sort((a, b) => ms(b.avaliado_em) - ms(a.avaliado_em))
        .map((s) => ({ t: ms(s.avaliado_em), nps: s.nota, total: s.total, texto: s.sugestao })),
      resultadosRecentes: done
        .slice()
        .sort((a, b) => b.t - a.t)
        .slice(0, 100)
        .map((s) => ({ t: s.t, total: s.total, nps: s.nota ?? null })),
      _concluidos: done,
    };
  }

  let ultimo = null;
  async function carregar() {
    try {
      const fuso = Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Sao_Paulo';
      const [linhas, acessos] = await Promise.all([
        buscarRespostas(),
        sb.rpc('resumo_acessos', { p_fuso: fuso }).then(({ data: d, error }) => {
          if (error) throw error;
          return d;
        }),
      ]);
      ultimo = montarStats(linhas, acessos);
      $('tela-login').hidden = true;
      $('painel').hidden = false;
      render(ultimo);
    } catch (e) {
      if (/negado|JWT|permission/i.test(e.message || '')) {
        await sb.auth.signOut();
        mostrarLogin('Este usuário não tem acesso ao painel. Confira a tabela "admins" no Supabase.');
      } else alert('Erro ao carregar dados: ' + (e.message || e));
    }
  }

  function exportarCsv() {
    const esc = (v) => {
      const s = v === undefined || v === null ? '' : String(v);
      return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const head = ['concluido_em', 'litros_dia', ...Q.perguntas.map((p) => p.id), 'nota_0a5', 'sugestao'];
    const rows = ultimo._concluidos
      .slice()
      .sort((a, b) => a.t - b.t)
      .map((s) => [
        new Date(s.t).toISOString(),
        s.total,
        ...Q.perguntas.map((p, i) => p.opcoes[s.respostas[i]]?.t ?? ''),
        s.nota ?? '',
        s.sugestao ?? '',
      ]);
    const csv = '﻿' + [head, ...rows].map((r) => r.map(esc).join(',')).join('\n');
    const a = el('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    a.download = `resultados-quiz-agua-${diaLocal(new Date())}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  function hbars(container, linhas, sufixo = '') {
    container.innerHTML = '';
    const max = Math.max(1, ...linhas.map((l) => Math.abs(l.v)));
    linhas.forEach((l) => {
      const row = el('div', 'hbar');
      row.append(el('span', '', l.r));
      const t = el('div', 't');
      const fill = el('span');
      fill.style.width = (Math.abs(l.v) / max) * 100 + '%';
      if (l.cor) fill.style.background = l.cor;
      t.append(fill);
      row.append(t, el('span', 'n', fmt(l.v) + sufixo));
      container.append(row);
    });
  }

  function render(s) {
    $('atualizado').textContent = 'Atualizado em ' + data(s.geradoEm);

    const taxa = s.iniciados ? Math.round((s.concluidos / s.iniciados) * 100) : 0;
    const kpis = [
      [fmt(s.acessos), 'Acessos (total)'],
      [fmt(s.visitantesUnicos), 'Visitantes únicos (aprox.)'],
      [fmt(s.iniciados), 'Quizzes iniciados'],
      [fmt(s.concluidos), `Concluídos (${taxa}%)`],
      [s.concluidos ? fmt(s.mediaLitros) + ' L' : '—', 'Consumo médio/dia'],
      [s.concluidos ? fmt(s.medianaLitros) + ' L' : '—', `Mediana (mín ${s.minLitros} · máx ${s.maxLitros})`],
      [s.nps.media !== null ? s.nps.media.toLocaleString('pt-BR') : '—', `Nota média (${s.feedbacks} avaliações)`],
    ];
    const k = $('kpis');
    k.innerHTML = '';
    kpis.forEach(([v, l]) => {
      const d = el('div', 'kpi');
      d.append(el('span', 'v', v), el('span', 'l', l));
      k.append(d);
    });

    // Acessos por dia
    const g = $('g-dias');
    g.innerHTML = '';
    const maxDia = Math.max(1, ...s.porDia.map((d) => d.acessos), ...s.porDia.map((d) => d.concluidos));
    s.porDia.forEach((d) => {
      const col = el('div', 'col');
      const [, m, dd] = d.dia.split('-');
      col.dataset.tip = `${dd}/${m}: ${d.acessos} acessos, ${d.concluidos} concluídos`;
      const a = el('span', 'a');
      a.style.height = (Math.max(0, d.acessos - d.concluidos) / maxDia) * 100 + '%';
      const c = el('span', 'c');
      c.style.height = (Math.min(d.concluidos, d.acessos || d.concluidos) / maxDia) * 100 + '%';
      col.append(a, c);
      g.append(col);
    });
    const p0 = s.porDia[0].dia.split('-'),
      p1 = s.porDia[s.porDia.length - 1].dia.split('-');
    $('g-dias-eixo').innerHTML = '';
    $('g-dias-eixo').append(el('span', '', `${p0[2]}/${p0[1]}`), el('span', '', `${p1[2]}/${p1[1]}`));

    hbars($('g-faixas'), s.faixas.map((f) => ({ r: f.rotulo, v: f.qtd })));

    hbars(
      $('g-atividades'),
      s.perguntas
        .map((p) => ({ r: `${p.icone} ${p.rotulo}`, v: p.mediaLitros, cor: p.mediaLitros < 0 ? 'var(--good)' : '' }))
        .sort((a, b) => b.v - a.v),
      ' L'
    );

    hbars($('g-nps'), s.nps.distribuicao.map((q, i) => ({ r: `Nota ${i}`, v: q })).reverse());
    const satisfeitos = s.feedbacks ? Math.round(((s.nps.distribuicao[4] + s.nps.distribuicao[5]) / s.feedbacks) * 100) : 0;
    $('g-nps').append(el('p', 'mini', s.feedbacks ? `${satisfeitos}% deram nota 4 ou 5.` : 'Nenhuma avaliação ainda.'));

    // Sugestões
    const sug = $('sugestoes');
    sug.innerHTML = '';
    $('n-sug').textContent = `(${s.sugestoes.length})`;
    if (!s.sugestoes.length) sug.append(el('p', 'vazio', 'Nenhuma sugestão ainda.'));
    s.sugestoes.forEach((x) => {
      const d = el('div', 'sug');
      d.append(el('p', '', x.texto), el('small', '', `${data(x.t)} · nota ${x.nps} · ${x.total} L/dia`));
      sug.append(d);
    });

    // Perguntas
    const pq = $('perguntas');
    const abertos = new Set([...pq.querySelectorAll('details[open]')].map((d) => d.dataset.id));
    pq.innerHTML = '';
    s.perguntas.forEach((p) => {
      const det = el('details', 'perg');
      det.dataset.id = p.id;
      det.open = abertos.has(p.id);
      const sum = el('summary');
      sum.append(el('span', '', `${p.icone} ${p.pergunta}`), el('small', '', `média ${fmt(p.mediaLitros)} L`));
      const corpo = el('div', 'corpo');
      const tot = p.opcoes.reduce((a, o) => a + o.qtd, 0) || 1;
      hbars(
        corpo,
        p.opcoes.map((o) => ({ r: `${o.texto} (${o.litros} L)`, v: o.qtd })),
        ''
      );
      corpo.querySelectorAll('.hbar .n').forEach((n, i) => (n.textContent = `${Math.round((p.opcoes[i].qtd / tot) * 100)}%`));
      det.append(sum, corpo);
      pq.append(det);
    });

    // Recentes
    const tb = $('recentes');
    tb.innerHTML = '';
    if (!s.resultadosRecentes.length) {
      const tr = el('tr');
      const td = el('td', 'vazio', 'Nenhum resultado ainda.');
      td.colSpan = 3;
      tr.append(td);
      tb.append(tr);
    }
    s.resultadosRecentes.forEach((r) => {
      const tr = el('tr');
      tr.append(el('td', '', data(r.t)), el('td', '', fmt(r.total) + ' L'), el('td', '', r.nps ?? '—'));
      tb.append(tr);
    });
  }

  $('form-login').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = e.submitter || $('form-login').querySelector('button');
    btn.disabled = true;
    const { error } = await sb.auth.signInWithPassword({ email: $('email').value.trim(), password: $('senha').value });
    btn.disabled = false;
    if (error) return mostrarLogin('E-mail ou senha inválidos.');
    $('senha').value = '';
    carregar();
  });
  $('btn-atualizar').addEventListener('click', carregar);
  $('btn-sair').addEventListener('click', async () => {
    await sb.auth.signOut();
    mostrarLogin();
  });
  $('btn-csv').addEventListener('click', () => ultimo && exportarCsv());

  if (!sb) {
    $('tela-login').hidden = false;
    $('form-login').hidden = true;
    $('login-erro').hidden = false;
    $('login-erro').textContent = 'Supabase não configurado: preencha o arquivo config.js.';
    return;
  }
  sb.auth.getSession().then(({ data: d }) => (d.session ? carregar() : mostrarLogin()));
  setInterval(() => !$('painel').hidden && carregar(), 60_000);
})();
