// Configuração do Supabase.
// Pegue estes dois valores em: Supabase → Project Settings → API (ou "API Keys").
// A chave pública (anon / publishable) PODE ficar visível no site: quem protege os dados
// são as regras criadas pelo supabase/schema.sql. NUNCA coloque aqui a "service_role"/"secret" key.
window.GOTA_CONFIG = {
  supabaseUrl: 'https://SEU-PROJETO.supabase.co',
  supabaseKey: 'COLE-AQUI-A-ANON-OU-PUBLISHABLE-KEY',
};
