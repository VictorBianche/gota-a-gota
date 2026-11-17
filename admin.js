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
      faixas,
      perguntas,
      nps: { media: comNota.length ? +(comNota.reduce((a, s) => a + s.nota, 0) / comNota.length).toFixed(2) : null, distribuicao: dist },
      sugestoes: done
        .filter((s) => s.sugestao)
        .sort((a, b) => ms(b.avaliado_em) - ms(a.avaliado_em))
        .map((s) => ({ nps: s.nota, total: s.total, texto: s.sugestao })),
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

  // ---------- Exportar PDF ----------
  function carregarScript(src) {
    return new Promise((ok, erro) => {
      const sc = document.createElement('script');
      sc.src = src;
      sc.onload = ok;
      sc.onerror = () => erro(new Error('Falha ao carregar ' + src));
      document.head.append(sc);
    });
  }
  let libsPdf = null;
  function carregarPdf() {
    if (!libsPdf) {
      libsPdf = carregarScript('https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js').then(() =>
        carregarScript('https://cdn.jsdelivr.net/npm/jspdf-autotable@3.8.2/dist/jspdf.plugin.autotable.min.js')
      );
      libsPdf.catch(() => (libsPdf = null));
    }
    return libsPdf.then(() => window.jspdf.jsPDF);
  }
  // As fontes padrão do PDF não têm emojis nem alguns símbolos: remove o que não for Latin-1
  const txt = (v) =>
    String(v ?? '')
      .replace(/[–—]/g, '-')
      .replace(/…/g, '...')
      .replace(/[^\x00-\xFF]/g, '')
      .replace(/\s+/g, ' ')
      .trim();

  async function exportarPdf() {
    const btn = $('btn-pdf');
    btn.disabled = true;
    btn.textContent = 'Gerando…';
    try {
      const JsPDF = await carregarPdf();
      const s = ultimo;
      const doc = new JsPDF({ unit: 'pt', format: 'a4' });
      const M = 40;
      const H = doc.internal.pageSize.getHeight();
      const AZUL = [11, 111, 164];
      const TINTA = [16, 40, 58];
      let y = M;

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(18);
      doc.setTextColor(...AZUL);
      doc.text('Gota a Gota - Relatório do quiz', M, y);
      y += 16;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(90);
      doc.text(txt(`Gerado em ${data(s.geradoEm)} · Consumo estimado em litros por pessoa por dia`), M, y);

      const secao = (titulo) => {
        y += 26;
        if (y > H - 90) {
          doc.addPage();
          y = M;
        }
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(12);
        doc.setTextColor(...TINTA);
        doc.text(txt(titulo), M, y);
        y += 6;
      };
      // Tabela; se "barra" for passado, desenha uma barra proporcional na última coluna
      const tabela = (head, body, barra, extra = {}) => {
        const max = barra ? Math.max(1, ...barra.map((v) => Math.abs(v))) : 0;
        doc.autoTable({
          startY: y,
          head: [head.map(txt)],
          body: body.map((r) => r.map(txt)),
          margin: { left: M, right: M },
          theme: 'grid',
          styles: { fontSize: 9, cellPadding: 4, textColor: TINTA, lineColor: [212, 228, 238] },
          headStyles: { fillColor: AZUL, textColor: 255 },
          columnStyles: barra ? { [head.length - 1]: { cellWidth: 140 } } : {},
          didDrawCell: (d) => {
            if (!barra || d.section !== 'body' || d.column.index !== head.length - 1) return;
            const v = barra[d.row.index] || 0;
            const w = ((d.cell.width - 8) * Math.abs(v)) / max;
            doc.setFillColor(...(v < 0 ? [31, 138, 91] : AZUL));
            doc.rect(d.cell.x + 4, d.cell.y + d.cell.height / 2 - 3, w, 6, 'F');
          },
          ...extra,
        });
        y = doc.lastAutoTable.finalY;
      };
      const pct = (q, tot) => (tot ? Math.round((q / tot) * 100) + '%' : '0%');

      secao('Resumo');
      const taxa = s.iniciados ? Math.round((s.concluidos / s.iniciados) * 100) : 0;
      tabela(
        ['Indicador', 'Valor'],
        [
          ['Acessos (total)', fmt(s.acessos)],
          ['Visitantes únicos (aprox.)', fmt(s.visitantesUnicos)],
          ['Quizzes iniciados', fmt(s.iniciados)],
          ['Quizzes concluídos', `${fmt(s.concluidos)} (${taxa}%)`],
          ['Consumo médio', s.concluidos ? fmt(s.mediaLitros) + ' L/dia' : '-'],
          ['Mediana (mín. / máx.)', s.concluidos ? `${fmt(s.medianaLitros)} L (${s.minLitros} / ${s.maxLitros})` : '-'],
          ['Nota média (0 a 5)', s.nps.media !== null ? `${s.nps.media.toLocaleString('pt-BR')} (${s.feedbacks} avaliações)` : '-'],
        ],
        null,
        { columnStyles: { 0: { cellWidth: 220, fontStyle: 'bold' } } }
      );

      secao('Distribuição do consumo (L/pessoa/dia)');
      tabela(
        ['Faixa', 'Pessoas', '%', ''],
        s.faixas.map((f) => [f.rotulo, f.qtd, pct(f.qtd, s.concluidos), '']),
        s.faixas.map((f) => f.qtd)
      );

      const ativ = s.perguntas.slice().sort((a, b) => b.mediaLitros - a.mediaLitros);
      secao('Média de litros por atividade');
      tabela(
        ['Atividade', 'Média (L/dia)', ''],
        ativ.map((p) => [p.rotulo, fmt(p.mediaLitros), '']),
        ativ.map((p) => p.mediaLitros)
      );

      secao('Avaliação do quiz (0 a 5)');
      const notas = [5, 4, 3, 2, 1, 0];
      tabela(
        ['Nota', 'Avaliações', '%', ''],
        notas.map((n) => [n, s.nps.distribuicao[n], pct(s.nps.distribuicao[n], s.feedbacks), '']),
        notas.map((n) => s.nps.distribuicao[n])
      );

      secao('Respostas por pergunta');
      s.perguntas.forEach((p) => {
        y += 8;
        if (y + 22 * (p.opcoes.length + 1) > H - 50) {
          doc.addPage(); // não divide a tabela de uma pergunta entre duas páginas
          y = M;
        }
        const tot = p.opcoes.reduce((a, o) => a + o.qtd, 0);
        tabela(
          [p.pergunta, 'L/dia', 'Pessoas', '%', ''],
          p.opcoes.map((o) => [o.texto, o.litros, o.qtd, pct(o.qtd, tot), '']),
          p.opcoes.map((o) => o.qtd),
          { columnStyles: { 4: { cellWidth: 90 } }, rowPageBreak: 'avoid' }
        );
      });

      secao(`Sugestões (${s.sugestoes.length})`);
      tabela(
        ['Nota', 'L/dia', 'Sugestão'],
        s.sugestoes.length ? s.sugestoes.map((x) => [x.nps, x.total, x.texto]) : [['-', '-', 'Nenhuma sugestão ainda.']],
        null,
        { columnStyles: { 0: { cellWidth: 36 }, 1: { cellWidth: 40 } } }
      );

      const paginas = doc.getNumberOfPages();
      for (let i = 1; i <= paginas; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(130);
        doc.text(`Página ${i} de ${paginas}`, doc.internal.pageSize.getWidth() - M, H - 20, { align: 'right' });
      }
      doc.save(`relatorio-quiz-agua-${diaLocal(new Date())}.pdf`);
    } catch (e) {
      alert('Não foi possível gerar o PDF: ' + (e.message || e));
    } finally {
      btn.disabled = false;
      btn.textContent = 'Exportar PDF';
    }
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
      d.append(el('p', '', x.texto), el('small', '', `nota ${x.nps} · ${x.total} L/dia`));
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
  $('btn-pdf').addEventListener('click', () => ultimo && exportarPdf());

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
