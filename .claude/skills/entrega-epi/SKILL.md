---
name: entrega-epi
description: Use ao trabalhar no fluxo de entrega, troca ou devolução de EPI no Almox SST (módulo SST pós-MVP), na assinatura digital do funcionário (tela ou link) e na ficha de EPI. É o fluxo mais sensível do módulo SST, por valer como prova legal.
---

# Entrega de EPI e assinatura

> Módulo pós-MVP (Fase 8). Depende do estoque (Fase 6): EPI é `items` com `kind = 'epi'`, e "variação" aqui é `item_variants`. Não implemente antes de a fase começar.

## Por que é crítico

A ficha de entrega assinada é o que a empresa apresenta na fiscalização e em processo trabalhista para provar que forneceu o EPI (NR-6). Ela precisa ser **completa, imutável e verificável**.

## Fluxo de balcão (meta: < 30 segundos)

1. **Buscar funcionário** — scan do crachá (mesmo QR do núcleo, skill `qr-balcao-pwa`) ou busca por nome, CPF ou matrícula. Funcionário sem CPF: pedir para completar o cadastro antes (a ficha exige CPF). Funcionário desligado não aparece por padrão.
2. **Painel do funcionário** — cargo, EPIs em posse com próxima troca, e uma seção "Sugeridos" com:
   - EPIs obrigatórios do cargo que ele nunca recebeu (motivo sugerido `primeira_entrega`);
   - itens com `next_replacement_at <= hoje` (motivo `troca_vencimento`).
     Um toque adiciona o item ao carrinho com o tamanho usado da última vez.
3. **Carrinho** — cada item: EPI, tamanho, quantidade, motivo, saldo disponível ao lado. Avisos inline:
   - saldo insuficiente → bloqueia;
   - CA vencido → exige marcar "Entregar mesmo assim" (grava `ca_expired_override = true` e vai para o audit_log);
   - troca antes do prazo com motivo `troca_vencimento` → sugere trocar o motivo para `troca_dano` ou `perda`.
4. **Confirmar** → chama `deliver_epis` (uma transação).
5. **Assinar** — duas opções lado a lado:
   - "Assinar agora" → abre tela cheia com o termo, lista de itens e `SignaturePad`;
   - "Enviar link" → gera token e abre o WhatsApp (`https://wa.me/55<fone>?text=...`) ou envia e-mail. No MVP, o link por WhatsApp é aberto pelo próprio almoxarife (sem API).
6. Tela de sucesso com "Nova entrega" em destaque.

## `deliver_epis` (plpgsql, security definer)

Entrada: `p_org, p_employee, p_location, p_items jsonb [{variant_id, quantity, reason, ca_override}], p_notes`.
Passos, nesta ordem, na mesma transação:

1. Checa papel (`owner, admin, safety, storekeeper`).
2. Checa que funcionário (com CPF → senão `cpf_obrigatorio`), local e variações são da org e ativos.
3. Para cada item: lock + checa saldo (skill `estoque-movimentacoes`); checa CA (`ca_expires_at < current_date` sem override → `ca_vencido`).
4. Insere `epi_deliveries` (status `pendente`).
5. Insere `epi_delivery_items` com `ca_number_snapshot` e `next_replacement_at = delivered_at::date + lifespan_days`.
6. Insere `stock_movements` `saida_entrega` com `delivery_item_id`.
7. Calcula `content_hash` = `sha256` do JSON canônico (chaves ordenadas): org, funcionário (id, nome, cpf), data/hora, itens (epi, tamanho, qtd, CA, motivo), texto do termo. Atualiza a entrega.
8. Grava audit_log. Retorna `delivery_id`.

## Assinatura

- **Token**: 32 bytes aleatórios (`crypto.randomBytes`), enviado em base64url na URL; no banco só `sha256(token)`. Validade 72 h, uso único. Reenviar = cancelar o anterior e gerar outro.
- **Página `/assinar/[token]`** (pública, mobile-first, sem layout do app): logo da empresa, "Olá, <primeiro nome>", lista de itens, termo completo, `SignaturePad`, botão "Confirmar recebimento". Checkbox "Li e concordo com o termo".
- **Gravação** (server action com client admin):
  1. valida token (existe, não usado, não expirado);
  2. faz upload do PNG em `signatures/{org}/{delivery}.png`;
  3. chama `sign_delivery` que recalcula o hash da entrega e compara com `content_hash` — se divergir, falha (`conteudo_alterado`);
  4. grava `signatures` (IP, user-agent, `term_text_snapshot`), marca `used_at`, muda status para `assinada`.
- Assinatura na tela do almoxarifado segue o mesmo caminho, com `channel = 'tela'`.
- Rate limit na rota pública (por IP e por token).

## Cancelar entrega

Só enquanto `signature_status = 'pendente'` e no mesmo dia. Gera estornos de estoque e marca `cancelada`. Depois de assinada, só devolução.

## Devolução e troca

- `return_epi(item_id, destination, notes)`: marca `returned_at`; se destino `estoque`, gera `devolucao` (+1).
- Troca = devolução (geralmente `descarte`) + nova entrega com motivo de troca. Na UI, botão "Trocar" no item em posse faz os dois passos.
- Desligamento do funcionário: tela lista itens em posse para registrar devolução de cada um.

## Ficha de EPI (PDF)

Ver skill `pdf-documentos`. Conteúdo mínimo: dados da empresa (nome, CNPJ, logo), dados do funcionário (nome, CPF, matrícula, cargo, setor, admissão), termo de responsabilidade, tabela com data, EPI, tamanho, qtd, **nº do CA (snapshot)**, motivo, data de devolução e assinatura (imagem miniatura) de cada entrega; rodapé com data de emissão e código de verificação (hash curto).

## Testes obrigatórios

- Entrega feliz: estoque baixa, itens criados, hash gravado, status pendente.
- Saldo insuficiente em 1 de 3 itens → nada é gravado (atomicidade).
- CA vencido sem override falha; com override grava a flag.
- Token expirado/usado/inexistente → mensagem amigável, nada gravado.
- Alterar item após criar a entrega → assinatura falha com `conteudo_alterado`.
- e2e Playwright: balcão completo + assinatura em viewport de celular.
