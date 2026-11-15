# 💧 Gota a Gota — Quiz do uso consciente da água

Quiz educativo, anônimo e sem cadastro. Cada resposta tem um "score" em **litros por dia**. No fim, o
usuário vê o consumo estimado de forma gráfica (tanque enchendo, galões de 20 L, litros por mês e por ano,
barras por atividade) e dicas personalizadas, além de uma avaliação de **0 a 5** e um campo de sugestão.

- Site estático, hospedado no **GitHub Pages**
- Dados guardados no **Supabase** (plano gratuito)
- Painel admin em `admin.html`, com login por e-mail e senha

## Configuração (uma vez só)

### 1. Supabase
1. Crie uma conta em [supabase.com](https://supabase.com) (dá para entrar com o GitHub) e crie um projeto
   no plano **Free**, na região **South America (São Paulo)**.
2. Abra `supabase/schema.sql`, troque `seu-email@exemplo.com` (última linha) pelo e-mail do admin.
3. No Supabase, vá em **SQL Editor → New query**, cole o arquivo inteiro e clique em **Run**.
4. Em **Authentication → Users → Add user → Create new user**, cadastre esse mesmo e-mail com uma senha
   (marque *Auto Confirm User*).
5. Em **Authentication → Sign In / Providers**, **desative "Allow new users to sign up"**. Assim ninguém
   mais consegue criar conta no seu projeto.
6. Em **Project Settings → API Keys**, copie a **Project URL** e a chave **anon / publishable**.

### 2. Site
Preencha `config.js` com a URL e a chave copiadas. A chave pública pode ficar visível no site, porque as
regras do banco é que protegem os dados. **Nunca** use a chave `service_role` / `secret`.

### 3. GitHub Pages
1. Crie um repositório no GitHub e envie este projeto (`git push`).
2. No repositório, vá em **Settings → Pages**. Em **Source**, escolha *Deploy from a branch*, depois
   **main** e **/ (root)**, e salve.
3. Em 1–2 minutos o site fica no ar em `https://SEU-USUARIO.github.io/NOME-DO-REPO/`.
   O painel fica em `.../admin.html`.

## Testar localmente
```bash
python3 -m http.server 8000
# abra http://localhost:8000
```

## Painel admin
- Acessos totais, visitantes únicos (aprox.), quizzes iniciados e concluídos
- Acessos e conclusões por dia (últimos 30 dias)
- Consumo médio, mediana, mínimo e máximo, e distribuição por faixas
- Média de litros por atividade e distribuição das respostas de cada pergunta
- Nota média (0–5), distribuição das notas e sugestões
- Exportação de relatório em PDF

## Segurança e anonimato
- Nenhum dado pessoal é coletado: sem cadastro, sem IP, sem cookies de rastreamento. O navegador guarda
  só um código aleatório, para contar visitantes únicos de forma aproximada.
- O quiz não tem acesso direto às tabelas. Ele só consegue chamar funções que validam os dados
  (`registrar_acesso`, `iniciar_quiz`, `concluir_quiz`, `enviar_avaliacao`).
- Só os e-mails cadastrados na tabela `admins` conseguem ler os resultados.
- O litro total é calculado a partir das respostas, e não enviado pelo navegador.

## Atenção: pausa do Supabase gratuito
No plano gratuito, o projeto **pausa depois de 7 dias sem uso**. Enquanto ele estiver pausado, o quiz
continua abrindo, mas não grava nada. Para reativar, entre no painel do Supabase e clique em **Restore project**.

## Editar perguntas
As perguntas e os litros de cada resposta ficam em `questions.js`. Se você mudar a **quantidade de
perguntas ou de opções**, atualize também a lista `opcoes` da função `concluir_quiz` em
`supabase/schema.sql` e rode o arquivo de novo no SQL Editor.
Os valores são estimativas educativas baseadas em referências públicas (ex.: Sabesp, ONU, SNIS).
