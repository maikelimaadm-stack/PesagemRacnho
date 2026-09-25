# E2 — Versionamento e atualização automática via Supabase (1.5.0, sem mudança de esquema)

Base técnica: `docs/arquitetura-produto/15-ATUALIZACAO-AUTOMATICA-SUPABASE.md` (arquitetura) e
`13-VERSIONAMENTO-RELEASE.md` (eixos de versão). Esta etapa IMPLEMENTA o doc 15 com os ajustes abaixo.
Supabase aqui serve só para versões e distribuição do instalador — dados do rebanho NÃO sobem.

## 1. Projeto Supabase

- Projeto dedicado `pesagens-individuais` (região sa-east-1), separado do ERP CONTROLE-DE-ESTOQUE.
  Criação: pela responsável no painel ou pelo Claude (Cowork) com a aprovação dela. O Claude Code NÃO cria
  projeto nem recebe `service_role` em mensagem.
- Configuração pública versionada em `config/update.json`:
  `{ "provider": "supabase", "projectRef": "<ref>", "bucket": "desktop-releases", "channels": ["stable","beta"] }`
- Segredos só em variáveis de ambiente da máquina de release (`SUPABASE_SERVICE_ROLE_KEY`,
  `RELEASE_SIGNING_PRIVATE_KEY`) — nunca no repositório, bundle, asar ou log.

### 1.1 Storage

Bucket público só-leitura `desktop-releases`, prefixos `windows/stable/` e `windows/beta/`, conteúdo e
regras do doc 15 §3 (arquivos versionados imutáveis; `latest.yml` publicado por último).

### 1.2 Banco (painel de versões) — migração SQL em `supabase/migrations/`

```sql
create table public.app_releases (
  version text primary key,               -- '1.5.0'
  channel text not null check (channel in ('stable','beta')),
  published_at timestamptz not null default now(),
  min_supported_version text,             -- abaixo disso o app avisa "atualização obrigatória"
  db_schema_version int not null,
  backup_format_version int not null,
  notes_md text not null,                 -- notas em linguagem simples, mostradas no app
  installer_sha512 text not null,
  manifest_sig text not null,
  rollout_percent int not null default 100 check (rollout_percent between 0 and 100),
  withdrawn boolean not null default false -- retirar versão com problema sem apagar
);
alter table public.app_releases enable row level security;
create policy "leitura publica" on public.app_releases for select using (withdrawn = false);

create table public.app_installs (          -- opcional, desligável em Configurações
  install_id uuid primary key,             -- gerado localmente, sem dado pessoal
  app_version text not null,
  channel text not null,
  db_schema_version int not null,
  last_seen_at timestamptz not null default now(),
  os text
);
alter table public.app_installs enable row level security;
-- sem SELECT/UPDATE/DELETE para anon; escrita só pela função abaixo
create function public.report_install(p_install_id uuid, p_version text, p_channel text, p_schema int, p_os text)
returns void language sql security definer set search_path = public as $$
  insert into app_installs values (p_install_id, p_version, p_channel, p_schema, now(), p_os)
  on conflict (install_id) do update set app_version = excluded.app_version, channel = excluded.channel,
    db_schema_version = excluded.db_schema_version, last_seen_at = now(), os = excluded.os;
$$;
grant execute on function public.report_install to anon;
```

Com isso a responsável vê no Supabase quais PCs estão em qual versão.

## 2. App (Electron)

1. `electron/update/updateService.cjs` conforme doc 15 §4 (electron-updater, só `app.isPackaged`,
   allowlist do host `<ref>.supabase.co`, checagem 45 s após abrir e a cada 6 h, sem concorrência).
2. Canal escolhido em Configurações › Atualizações: **Estável** (padrão) ou **Teste**.
3. Rollout: o app sorteia um número 0–99 fixo por instalação; só oferece a versão se
   `numero < rollout_percent`. Versão `withdrawn` nunca é oferecida.
4. Verificações antes de instalar: SHA-512 do feed + assinatura Ed25519 do `release-manifest` com chave
   pública embutida (funciona mesmo sem certificado Authenticode). Authenticode, quando existir,
   soma-se a isso (`publisherName`).
5. Enquanto NÃO houver Authenticode: `autoDownload = false`; o usuário clica "Baixar" e "Reiniciar e
   atualizar". Com Authenticode: download automático em segundo plano.
6. Nunca reiniciar com lançamento, importação, restauração, migração ou fechamento abertos (consultar
   um `criticalOperationGuard` no main; criar se não existir).
7. Preload expõe só `updates.getStatus/check/download/install/onStatus` (doc 15 §4). Atualizar
   `preload:contract:verify`.
8. UI: selo discreto na topbar "Nova versão"; diálogo com notas (`notes_md`), tamanho e progresso;
   Manutenção › Sobre mostra versão atual, canal, última checagem e botão "Procurar atualização".
9. `min_supported_version`: se a versão instalada for menor, aviso fixo "Atualização obrigatória"
   (continua funcionando offline; só insiste quando online).
10. Heartbeat opcional (`report_install`) 1×/dia quando online; desligável; nunca envia dado do rebanho.

## 3. Pipeline de publicação (máquina da responsável)

`npm run release:publish -- --channel beta|stable`:
1. exige árvore git limpa e tag `vX.Y.Z` inexistente;
2. `test:full` verde → `dist` → gates de pacote atuais;
3. gera `release-manifest` + assinatura Ed25519;
4. envia Setup por upload retomável (TUS), depois blockmap, manifesto, assinatura, notas;
5. confere cada objeto remoto (tamanho + SHA);
6. insere/atualiza `app_releases` (service_role, só na máquina de release);
7. publica `latest.yml` POR ÚLTIMO;
8. cria tag git `vX.Y.Z`.
`npm run release:promote -- X.Y.Z` copia do beta para stable (sem rebuild) após 7 dias.
`npm run release:withdraw -- X.Y.Z` marca `withdrawn = true`.

## 4. Organização (limpeza que acompanha a etapa)

- Instaladores e pastas `release*/`, `.audit-tmp/` fora do git (`.gitignore`), nunca na raiz do projeto.
- A pasta `projeto/MAKGESTAO-1.1.18` é cópia antiga: registrar no REPORT que pode ser arquivada
  (NÃO apagar; a responsável decide).
- 1.5.0 é a versão **bootstrap**: instalada manualmente uma última vez; daí em diante chega sozinha.

## 5. Gates

Os 14 gates do doc 15 §11 viram scripts `update:*:verify` (usar servidor HTTP local de teste, sem
Supabase real) + `release:publish:dry-run:verify` (pipeline completo com Storage simulado).

## 6. Aceite humano

1. Instalar 1.5.0 manualmente. 2. Publicar 1.5.1 de teste no canal beta. 3. Com o PC no canal Teste,
o selo aparece, baixa, reinicia e os dados continuam. 4. PC no canal Estável NÃO vê a 1.5.1.
5. Sem internet: app abre normal, sem aviso. 6. No Supabase, `app_installs` mostra o PC na 1.5.1.
