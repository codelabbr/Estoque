---
name: pdf-documentos
description: Use ao gerar qualquer PDF ou exportação no Almox SST — ficha de EPI, relatórios de conformidade, vencimentos, estoque, custo e dossiê de fiscalização — e exportações CSV.
---

# PDFs e relatórios

## Tecnologia

`@react-pdf/renderer` em Route Handler (`src/app/(app)/[orgSlug]/relatorios/.../route.ts`) com `runtime = 'nodejs'`. Documentos em `src/pdf/`. Nada de gerar PDF no cliente.

## Estrutura comum (`src/pdf/components/`)

- `DocHeader`: logo da organização (URL assinada), razão social, CNPJ, título do documento, período.
- `DocFooter`: "Emitido em dd/MM/yyyy HH:mm por <usuário> — Página X de Y" + código de verificação.
- `DocTable`: tabela com cabeçalho repetido a cada página e quebra de linha segura.
- Fonte Inter registrada (`Font.register`), tamanho base 9pt, A4 retrato (paisagem para matriz de treinamentos).

## Documentos

| Documento              | Conteúdo                                                                            | Orientação |
| ---------------------- | ----------------------------------------------------------------------------------- | ---------- |
| Ficha de EPI           | ver skill `entrega-epi`                                                             | retrato    |
| Conformidade           | por setor/cargo: funcionário, status, pendências                                    | retrato    |
| Matriz de treinamentos | funcionários × treinamentos com status e validade                                   | paisagem   |
| Vencimentos            | treinamentos, trocas e CAs vencendo no período                                      | retrato    |
| Posição de estoque     | EPI, tamanho, saldo, mínimo, custo médio, valor total                               | retrato    |
| Movimentações          | extrato do período                                                                  | paisagem   |
| Custo de EPI           | por setor e por funcionário no período, usando custo médio                          | retrato    |
| Dossiê de fiscalização | ZIP com ficha de EPI + certificados de cada funcionário selecionado + índice em PDF | —          |

## Código de verificação

`sha256` de (tipo do documento, org, parâmetros, data de emissão) → mostre os 12 primeiros caracteres. Grave em `document_log` (org, user, type, params, hash, created_at) para permitir conferir autenticidade depois (fase 2: página pública de verificação).

## Performance

- Busque todos os dados com uma query/visão por documento, não N+1.
- Imagens de assinatura: baixe em paralelo com limite (p-limit 5) e redimensione para miniatura.
- Relatórios muito grandes (> 500 funcionários): gerar em background e avisar por e-mail (fase 2).

## CSV

Toda tabela de relatório tem "Exportar CSV": separador `;`, UTF-8 com BOM (abre certo no Excel brasileiro), datas dd/MM/yyyy, decimais com vírgula.

## Testes

Snapshot do conteúdo textual do PDF (extraia com `pdf-parse`) para a ficha de EPI e um relatório; teste que a ficha contém o CA **snapshot**, não o CA atual do cadastro.
