-- =====================================================================
-- Gota a Gota — estrutura do banco no Supabase
-- Cole TUDO no Supabase: SQL Editor → New query → Run.
-- Antes de rodar, troque o e-mail na última seção pelo e-mail do admin.
-- =====================================================================

-- ---------- Tabelas ----------
create table if not exists public.acessos (
  id          bigint generated always as identity primary key,
  criado_em   timestamptz not null default now(),
  visitante   text not null check (visitante ~ '^[a-zA-Z0-9-]{8,64}$')
);
create index if not exists acessos_criado_em_idx on public.acessos (criado_em);

create table if not exists public.respostas (
  id            text primary key check (id ~ '^[a-zA-Z0-9-]{8,64}$'),
  iniciado_em   timestamptz not null default now(),
  concluido_em  timestamptz,
  respostas     smallint[],
  nota          smallint check (nota between 0 and 5),
  sugestao      text check (char_length(sugestao) <= 1000),
  avaliado_em   timestamptz
);
create index if not exists respostas_concluido_em_idx on public.respostas (concluido_em);

-- Quem pode ver o painel admin
create table if not exists public.admins (
  email text primary key
);

-- ---------- Segurança: ninguém acessa as tabelas diretamente ----------
alter table public.acessos   enable row level security;
alter table public.respostas enable row level security;
alter table public.admins    enable row level security;

revoke all on public.acessos, public.respostas, public.admins from anon, authenticated;

create or replace function public.eh_admin()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (select 1 from public.admins where lower(email) = lower(auth.jwt() ->> 'email'));
$$;

-- Admin pode LER as respostas (somente leitura)
grant select on public.respostas to authenticated;
drop policy if exists "admin le respostas" on public.respostas;
create policy "admin le respostas" on public.respostas
  for select to authenticated using (public.eh_admin());

-- ---------- Funções públicas (usadas pelo quiz, sem login) ----------
-- Elas validam os dados e só fazem a operação permitida.

create or replace function public.registrar_acesso(p_visitante text)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  insert into public.acessos (visitante) values (p_visitante);
end;
$$;

create or replace function public.iniciar_quiz(p_sessao text)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  insert into public.respostas (id) values (p_sessao) on conflict (id) do nothing;
end;
$$;

-- p_respostas: índice da opção escolhida em cada pergunta (começando em 0).
-- "opcoes" = quantidade de opções de cada pergunta, na ordem do questions.js.
-- >>> Se mudar as perguntas em questions.js, atualize esta lista e rode de novo. <<<
create or replace function public.concluir_quiz(p_sessao text, p_respostas smallint[])
returns void
language plpgsql security definer set search_path = public
as $$
declare
  opcoes smallint[] := array[4,4,4,4,3,4,4,4,4,4,3];
  i int;
begin
  if p_respostas is null or coalesce(array_length(p_respostas, 1), 0) <> array_length(opcoes, 1) then
    raise exception 'Respostas inválidas';
  end if;
  for i in 1 .. array_length(opcoes, 1) loop
    if p_respostas[i] is null or p_respostas[i] < 0 or p_respostas[i] >= opcoes[i] then
      raise exception 'Respostas inválidas';
    end if;
  end loop;

  update public.respostas
     set respostas = p_respostas, concluido_em = now()
   where id = p_sessao and concluido_em is null;
  if not found then
    raise exception 'Sessão inválida ou já concluída';
  end if;
end;
$$;

create or replace function public.enviar_avaliacao(p_sessao text, p_nota smallint, p_sugestao text)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if p_nota is null or p_nota < 0 or p_nota > 5 then
    raise exception 'Nota deve ser de 0 a 5';
  end if;
  update public.respostas
     set nota = p_nota,
         sugestao = nullif(left(btrim(coalesce(p_sugestao, '')), 1000), ''),
         avaliado_em = now()
   where id = p_sessao and concluido_em is not null and nota is null;
  if not found then
    raise exception 'Conclua o quiz antes de avaliar (ou avaliação já enviada)';
  end if;
end;
$$;

-- ---------- Função do painel (somente admin) ----------
create or replace function public.resumo_acessos(p_fuso text default 'America/Sao_Paulo')
returns json
language plpgsql stable security definer set search_path = public
as $$
declare
  resultado json;
begin
  if not public.eh_admin() then
    raise exception 'Acesso negado';
  end if;
  select json_build_object(
    'total',  (select count(*) from public.acessos),
    'unicos', (select count(distinct visitante) from public.acessos),
    'por_dia', coalesce((
      select json_agg(json_build_object('dia', dia, 'acessos', n) order by dia)
      from (
        select (criado_em at time zone p_fuso)::date as dia, count(*) as n
        from public.acessos
        where criado_em >= now() - interval '31 days'
        group by 1
      ) d
    ), '[]'::json)
  ) into resultado;
  return resultado;
end;
$$;

-- Permissões das funções
revoke all on function public.registrar_acesso(text), public.iniciar_quiz(text),
  public.concluir_quiz(text, smallint[]), public.enviar_avaliacao(text, smallint, text),
  public.resumo_acessos(text), public.eh_admin() from public;
grant execute on function public.registrar_acesso(text), public.iniciar_quiz(text),
  public.concluir_quiz(text, smallint[]), public.enviar_avaliacao(text, smallint, text)
  to anon, authenticated;
grant execute on function public.resumo_acessos(text), public.eh_admin() to authenticated;

-- ---------- Admin ----------
-- >>> TROQUE pelo e-mail que você vai cadastrar em Authentication → Users <<<
insert into public.admins (email) values ('seu-email@exemplo.com') on conflict do nothing;
