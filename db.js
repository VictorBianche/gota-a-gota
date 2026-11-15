// Cria o cliente do Supabase a partir do config.js (window.GotaDB fica null se não estiver configurado).
(function () {
  const c = window.GOTA_CONFIG || {};
  const configurado = c.supabaseUrl && c.supabaseKey && !/SEU-PROJETO|COLE-AQUI/.test(c.supabaseUrl + c.supabaseKey);
  window.GotaDB = configurado && window.supabase ? window.supabase.createClient(c.supabaseUrl, c.supabaseKey) : null;
  if (!window.GotaDB) console.warn('Supabase não configurado: edite o arquivo config.js');
})();
