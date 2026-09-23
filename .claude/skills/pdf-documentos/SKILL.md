---
name: pdf-documentos
description: Use ao gerar qualquer PDF ou exportação no Almox SST — etiquetas QR de ferramentas, crachás, relatórios de patrimônio, retiradas, atrasos, perdas, histórico de ferramenta, e nos módulos seguintes estoque, ficha de EPI e treinamentos — e exportações CSV.
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

### Núcleo (MVP)

| Documento               | Conteúdo                                                                          | Orientação |
| ----------------------- | --------------------------------------------------------------------------------- | ---------- |
| Etiquetas de ferramenta | grade A4 ou rolo térmico; QR + nome + código (ver skill `qr-balcao-pwa`)          | —          |
| Crachás                 | cartão 85,6 × 54 mm; foto, nome, matrícula, setor, QR                             | —          |
| Patrimônio              | ferramentas por categoria/local/status, valor de referência, subtotais e total    | retrato    |
| Retiradas no período    | data, ferramenta, funcionário, setor, liberado por, previsão, devolução, condição | paisagem   |
| Atrasos                 | retiradas abertas atrasadas agrupadas por funcionário, com tempo de atraso        | retrato    |
| Perdas e avarias        | por funcionário e setor no período, com valor de referência                       | retrato    |
| Histórico da ferramenta | dados + linha do tempo completa + manutenções                                     | retrato    |

### Módulos pós-MVP

| Documento              | Conteúdo                                                                            | Orientação |
| ---------------------- | ----------------------------------------------------------------------------------- | ---------- |
| Ficha de EPI           | ver skill `entrega-epi`                                                             | retrato    |
| Conformidade           | por setor/cargo: funcionário, status, pendências                                    | retrato    |
| Matriz de treinamentos | funcionários × treinamentos com status e validade                                   | paisagem   |
| Vencimentos            | treinamentos, trocas e CAs vencendo no período                                      | retrato    |
| Posição de estoque     | item, tamanho, saldo, mínimo, custo médio, valor total                              | retrato    |
| Movimentações          | extrato do período                                                                  | paisagem   |
| Custo de EPI           | por setor e por funcionário no período, usando custo médio                          | retrato    |
| Dossiê de fiscalização | ZIP com ficha de EPI + certificados de cada funcionário selecionado + índice em PDF | —          |

## Código de verificação

`sha256` de (tipo do documento, org, parâmetros, data de emissão) → mostre os 12 primeiros caracteres. Grave em `document_log` (org, user, type, params, hash, created_at) para permitir conferir autenticidade depois (fase 2: página pública de verificação).

## Performance

- Busque todos os dados com uma query/visão por documento, não N+1.
- Imagens (fotos de ferramenta, assinaturas): baixe em paralelo com limite (p-limit 5) e redimensione para miniatura.
- Etiquetas: limite de 500 por PDF; QR gerado como SVG vetorial (nítido em qualquer impressora).
- Relatórios muito grandes (> 2.000 linhas): gerar em background e avisar por e-mail (pós-MVP).

## CSV

Toda tabela de relatório tem "Exportar CSV": separador `;`, UTF-8 com BOM (abre certo no Excel brasileiro), datas dd/MM/yyyy, decimais com vírgula.

## Testes

Snapshot do conteúdo textual do PDF (extraia com `pdf-parse`) para o relatório de patrimônio e o histórico de ferramenta; teste que a etiqueta contém a URL `/t/<token>` atual (e não a de um token regenerado). Módulo EPI: a ficha contém o CA **snapshot**, não o CA atual do cadastro.
