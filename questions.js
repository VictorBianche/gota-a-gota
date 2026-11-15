// Perguntas do quiz — compartilhado entre o navegador e o servidor.
// "l" = litros estimados por pessoa, por dia, para aquela opção.
// Estimativas baseadas em referências públicas de companhias de saneamento (ex.: Sabesp)
// e servem para fins educativos, não como medição exata.
(function (root) {
  const QUIZ = {
    referencias: {
      onu: 110, // L/pessoa/dia considerados suficientes pela ONU
      brasil: 150, // média aproximada de consumo per capita no Brasil (SNIS)
    },
    perguntas: [
      {
        id: 'banho',
        rotulo: 'Banho',
        icone: '🚿',
        pergunta: 'Quanto tempo dura, em média, o seu banho?',
        reflexao: 'Um chuveiro com o registro meio aberto gasta cerca de 9 litros por minuto. Você costuma reparar no tempo que passa debaixo d’água?',
        dica: 'Banhos de até 5 minutos, fechando o registro enquanto se ensaboa, podem economizar mais de 80 litros por banho.',
        opcoes: [
          { t: 'Até 5 minutos', l: 45 },
          { t: 'De 5 a 10 minutos', l: 70 },
          { t: 'De 10 a 15 minutos', l: 115 },
          { t: 'Mais de 15 minutos', l: 160 },
        ],
      },
      {
        id: 'dentes',
        rotulo: 'Escovar os dentes',
        icone: '🪥',
        pergunta: 'Enquanto escova os dentes, o que acontece com a torneira?',
        reflexao: 'Uma torneira aberta por 5 minutos gasta cerca de 12 litros. Quantas vezes por dia você escova os dentes?',
        dica: 'Feche a torneira e use um copo para enxaguar: cai de ~12 L para menos de 1 L por escovação.',
        opcoes: [
          { t: 'Fecho a torneira e uso um copo para enxaguar', l: 2 },
          { t: 'Fecho a torneira enquanto escovo', l: 4 },
          { t: 'Às vezes deixo aberta', l: 18 },
          { t: 'Fica aberta o tempo todo', l: 36 },
        ],
      },
      {
        id: 'descarga',
        rotulo: 'Descarga',
        icone: '🚽',
        pergunta: 'Que tipo de descarga existe no banheiro que você mais usa?',
        reflexao: 'A descarga é um dos maiores consumos da casa e acontece várias vezes ao dia, quase sem a gente perceber.',
        dica: 'Caixas acopladas com duplo acionamento (3 L / 6 L) gastam até 3x menos que válvulas antigas de parede.',
        opcoes: [
          { t: 'Caixa acoplada com dois botões (meia/total)', l: 22 },
          { t: 'Caixa acoplada comum', l: 32 },
          { t: 'Não sei', l: 45 },
          { t: 'Válvula de parede (modelo antigo)', l: 65 },
        ],
      },
      {
        id: 'louca',
        rotulo: 'Lavar louça',
        icone: '🍽️',
        pergunta: 'Como a louça costuma ser lavada na sua casa?',
        reflexao: 'Lavar louça com a torneira aberta por 15 minutos pode consumir mais de 100 litros. Quanto tempo a água fica correndo na pia?',
        dica: 'Ensaboe tudo com a torneira fechada e enxágue de uma vez; ou use a lava-louças apenas cheia.',
        opcoes: [
          { t: 'Lava-louças, só ligada quando está cheia', l: 12 },
          { t: 'Ensaboo tudo com a torneira fechada e enxáguo junto', l: 20 },
          { t: 'Enxáguo peça por peça com a torneira entreaberta', l: 60 },
          { t: 'Com a torneira aberta o tempo todo', l: 117 },
        ],
      },
      {
        id: 'alimentos',
        rotulo: 'Lavar alimentos',
        icone: '🥬',
        pergunta: 'Como você lava frutas, verduras e legumes?',
        reflexao: 'Pequenos hábitos na cozinha se repetem todos os dias e somam muitos litros no fim do mês.',
        dica: 'Use uma bacia com água para higienizar os alimentos e reaproveite essa água para regar plantas.',
        opcoes: [
          { t: 'Em uma bacia e reaproveito a água', l: 2 },
          { t: 'Em uma bacia', l: 4 },
          { t: 'Debaixo da torneira aberta', l: 15 },
        ],
      },
      {
        id: 'roupa',
        rotulo: 'Lavar roupa',
        icone: '👕',
        pergunta: 'Com que frequência a máquina de lavar (ou o tanque) é usada?',
        reflexao: 'Uma máquina de 5 kg usa cerca de 135 litros por ciclo. Ela costuma ser ligada cheia ou com poucas peças?',
        dica: 'Junte roupa e lave na capacidade máxima da máquina. Reaproveite a água do enxágue para limpar o quintal.',
        opcoes: [
          { t: '1 a 2 vezes por semana, sempre cheia', l: 30 },
          { t: '3 a 4 vezes por semana', l: 65 },
          { t: 'Quase todos os dias, mesmo com pouca roupa', l: 120 },
          { t: 'No tanque, com a torneira aberta', l: 90 },
        ],
      },
      {
        id: 'quintal',
        rotulo: 'Calçada e quintal',
        icone: '🧹',
        pergunta: 'Como você limpa a calçada, o quintal ou a garagem?',
        reflexao: 'Uma mangueira aberta por 15 minutos gasta cerca de 280 litros. Será que a vassoura não resolveria?',
        dica: 'Use vassoura e balde — e, se possível, a água reaproveitada da máquina de lavar.',
        opcoes: [
          { t: 'Não se aplica / não tenho', l: 0 },
          { t: 'Vassoura e balde', l: 5 },
          { t: 'Mangueira, cerca de uma vez por semana', l: 40 },
          { t: 'Mangueira, várias vezes por semana', l: 120 },
        ],
      },
      {
        id: 'carro',
        rotulo: 'Lavar carro/moto',
        icone: '🚗',
        pergunta: 'Como você lava o carro ou a moto?',
        reflexao: 'Lavar o carro com mangueira por 30 minutos pode gastar até 560 litros — mais do que uma pessoa usa em quatro dias.',
        dica: 'Use balde e pano (cerca de 40 L) ou lava-rápidos que reaproveitam água.',
        opcoes: [
          { t: 'Não tenho / lavo em lava-rápido com reuso', l: 0 },
          { t: 'Com balde e pano', l: 6 },
          { t: 'Com mangueira, uma vez por mês', l: 19 },
          { t: 'Com mangueira, toda semana', l: 80 },
        ],
      },
      {
        id: 'plantas',
        rotulo: 'Plantas e jardim',
        icone: '🪴',
        pergunta: 'Como você rega plantas e jardim?',
        reflexao: 'Regar no sol forte faz boa parte da água evaporar antes de chegar às raízes.',
        dica: 'Regue com regador, de manhã cedo ou à noite, e aproveite água da chuva.',
        opcoes: [
          { t: 'Não tenho plantas', l: 0 },
          { t: 'Com regador, de manhã cedo ou à noite', l: 5 },
          { t: 'Com mangueira, em horários frescos', l: 30 },
          { t: 'Com mangueira, a qualquer hora (inclusive no sol)', l: 90 },
        ],
      },
      {
        id: 'vazamentos',
        rotulo: 'Vazamentos',
        icone: '💧',
        pergunta: 'Existe algum vazamento na sua casa (torneira pingando, descarga escorrendo)?',
        reflexao: 'Uma torneira pingando desperdiça cerca de 46 litros por dia. Uma descarga escorrendo pode passar de 140 litros.',
        dica: 'Confira o hidrômetro com todas as torneiras fechadas: se ele girar, há vazamento. Conserte o quanto antes.',
        opcoes: [
          { t: 'Não. Verifico e conserto logo quando aparece', l: 0 },
          { t: 'Não sei, nunca verifiquei', l: 25 },
          { t: 'Sim, uma torneira pingando', l: 46 },
          { t: 'Sim, a descarga fica escorrendo', l: 144 },
        ],
      },
      {
        id: 'reuso',
        rotulo: 'Reuso de água',
        icone: '♻️',
        pergunta: 'Você reaproveita água (da chuva, da máquina de lavar, do enxágue)?',
        reflexao: 'Nem toda tarefa precisa de água tratada. Que água da sua casa poderia ter uma segunda vida?',
        dica: 'Água da máquina e da chuva servem para lavar quintal, regar plantas e até para a descarga.',
        opcoes: [
          { t: 'Sim, com frequência', l: -20 },
          { t: 'Às vezes', l: -8 },
          { t: 'Nunca', l: 0 },
        ],
      },
    ],
  };

  QUIZ.calcular = function (respostas) {
    if (!Array.isArray(respostas) || respostas.length !== QUIZ.perguntas.length) return null;
    let total = 0;
    const itens = [];
    for (let i = 0; i < QUIZ.perguntas.length; i++) {
      const p = QUIZ.perguntas[i];
      const idx = respostas[i];
      if (!Number.isInteger(idx) || idx < 0 || idx >= p.opcoes.length) return null;
      const l = p.opcoes[idx].l;
      total += l;
      const melhor = Math.min(...p.opcoes.map((o) => o.l));
      itens.push({ id: p.id, rotulo: p.rotulo, icone: p.icone, litros: l, podeMelhorar: l > melhor, dica: p.dica });
    }
    return { total: Math.max(0, Math.round(total)), itens };
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = QUIZ;
  else root.QUIZ = QUIZ;
})(typeof self !== 'undefined' ? self : this);
