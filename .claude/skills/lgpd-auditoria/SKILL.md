---
name: lgpd-auditoria
description: Use ao lidar com dados pessoais de funcionários (CPF, telefone, foto, assinatura), log de auditoria, exportação ou exclusão de dados, termos de uso e retenção no Almox SST.
---

# LGPD e auditoria

## Papéis na LGPD

A empresa cliente é a **controladora** dos dados dos funcionários dela; o Almox SST é **operador**. Isso precisa estar nos Termos de Uso e no contrato (DPA). A base legal típica do cliente para o controle de ferramentas é a execução do contrato de trabalho e o legítimo interesse de proteger o patrimônio; nos módulos SST, cumprimento de obrigação legal (registro de EPI e treinamentos). Não é consentimento — não peça "aceite" de privacidade ao funcionário como condição para retirar ferramenta ou assinar entrega; mostre um aviso curto com link para a política.

## Minimização

- Colete só o necessário: nome, matrícula, cargo, setor, datas; CPF é **opcional** no núcleo (só obrigatório para a ficha de EPI); telefone/e-mail só se for usar. Nada de endereço, RG, dados de saúde (ASO fica fora do escopo).
- Fotos de devolução/avaria mostram a ferramenta, não a pessoa; oriente isso na tela de captura. Remova EXIF (localização) antes do upload.
- Histórico de retiradas é dado pessoal (mostra o que cada pessoa fez e quando): leitura só para membros da org, nunca exposto em rota pública.
- Mascarar CPF em listas e páginas públicas (`***.456.789-**`); CPF completo só no perfil e na ficha.
- Logs de aplicação e Sentry **sem** CPF, telefone ou imagem de assinatura (scrubbing em `beforeSend`).

## Segurança

- Buckets privados; URL assinada de 60 s.
- Tokens de assinatura só como hash. Tokens de QR (ferramenta/crachá) não são segredo de acesso — a rota exige login e ser membro —, mas são aleatórios e regeneráveis.
- Supabase na região São Paulo; backups do provedor.
- Sessão: cookies httpOnly via `@supabase/ssr`; MFA opcional para `owner/admin` (fase 2).
- Headers de segurança (CSP, HSTS, X-Frame-Options) no `next.config`.

## Auditoria (`audit_log`)

- Trigger genérico `audit_trigger()` em tabelas de negócio grava `actor_id = auth.uid()`, tabela, id, `old_data`, `new_data` (removendo colunas sensíveis como caminhos de assinatura se não forem necessários).
- RPCs gravam uma linha própria com `action = '<nome_da_funcao>'` e os parâmetros.
- Eventos que sempre vão para auditoria: descarte de ferramenta, ferramenta localizada/reativada, regeneração de QR, alteração de valor de referência, mudança de papel de membro, exportação de dados; nos módulos seguintes, estorno, ajuste de inventário, entrega com CA vencido, cancelamento de entrega, alteração manual de validade de treinamento, acesso ao dossiê.
- `tool_events` é o histórico **de negócio** (mostrado ao usuário); `audit_log` é a trilha **técnica** (quem mudou qual linha). Os dois existem; não substitua um pelo outro.
- Tela "Histórico" (owner/admin) com filtros por usuário, entidade e período.
- `audit_log` é imutável e sem RLS de escrita para usuários.

## Direitos do titular e encerramento

- Exportar dados de um funcionário (JSON + PDFs) para atender pedido do titular via empresa.
- "Excluir funcionário": **não** apagar registros de retirada, entrega ou treinamento enquanto houver obrigação legal ou necessidade de guarda; em vez disso, arquivar. Anonimização (substituir nome/CPF/telefone por hash, remover foto) só sob ação explícita do `owner`, com aviso de que a ficha deixará de identificar a pessoa. Registre a política de retenção em `DECISIONS.md` e deixe o prazo configurável — confirme prazos com assessoria jurídica.
- Encerramento de conta da organização: exportação completa (CSV + PDFs + arquivos) disponível por 30 dias, depois exclusão.

## Documentos a criar (fase 6)

`/termos`, `/privacidade`, modelo de DPA. Textos iniciais podem ser rascunhados, mas marque claramente: "Revisar com advogado antes de publicar."
