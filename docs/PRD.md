# PRD — Almox SST

## 1. Problema

Em pequenas e médias indústrias, ferramentas e equipamentos (furadeiras, esmerilhadeiras, torquímetros, multímetros, talhas, instrumentos de medição) circulam pela fábrica sem controle confiável. O controle vive em caderno, planilha ou na memória do almoxarife. Resultado:

- Ninguém sabe **onde está** uma ferramenta nem **com quem** ela está.
- Ferramentas somem e não há como saber quem foi o último a usar.
- Avarias não são registradas; o equipamento volta quebrado e o próximo usuário descobre na hora de usar.
- Manutenção e calibração vencem sem ninguém perceber.
- O patrimônio real (quantidade e valor) é desconhecido, e a empresa recompra o que já tem.

O mesmo almoxarifado também controla materiais de consumo e EPIs, e a empresa precisa provar entrega de EPI (NR-6) e treinamentos obrigatórios (NRs). Esses são módulos secundários do produto.

## 2. Proposta de valor

"Saiba em segundos onde está cada ferramenta, com quem ela está e quando volta — com o histórico completo para cobrar perdas e avarias."

## 3. Personas

| Persona                          | Descrição                                       | O que precisa                                                               |
| -------------------------------- | ----------------------------------------------- | --------------------------------------------------------------------------- |
| **Almoxarife** (principal)       | Opera o balcão, libera e recebe ferramentas     | Retirada e devolução em segundos pelo celular/tablet, saber o que está fora |
| **Gestor** (produção/manutenção) | Responde pelas ferramentas da área              | Ver atrasos, perdas e avarias; aprovar solicitações (pós-MVP)               |
| **Dono / gerente**               | Decide compras e cobra resultados               | Patrimônio total, perdas, equipamentos parados, ranking por setor           |
| **Funcionário**                  | Retira e devolve ferramentas                    | Pegar rápido, sem precisar de conta; saber o que está no nome dele          |
| **Técnico de segurança**         | Responsável por SST (módulos EPI e NR, pós-MVP) | Fichas de EPI, treinamentos em dia                                          |

## 4. Papéis e permissões

| Papel         | Permissões                                                                                      |
| ------------- | ----------------------------------------------------------------------------------------------- |
| `owner`       | Tudo, incluindo plano, cobrança e excluir organização                                           |
| `admin`       | Tudo exceto cobrança e excluir organização; gerencia membros e estrutura (unidades, locais)     |
| `storekeeper` | Cadastro de ferramentas e funcionários, retirada, devolução, avaria, perda, manutenção          |
| `manager`     | Leitura de tudo + aprovar/rejeitar solicitações (adicionado junto com o módulo de solicitações) |
| `safety`      | Módulos EPI e NR (pós-MVP); leitura do restante                                                 |
| `viewer`      | Somente leitura, incluindo relatórios                                                           |

Descarte de ferramenta (baixa de patrimônio) e reabertura de ferramenta perdida: só `owner` e `admin`.

Um usuário pode ser membro de várias organizações. **O funcionário não é usuário do sistema**: ele é identificado no balcão pelo crachá (QR) ou por busca (nome, matrícula). Autoatendimento com PIN fica para depois do MVP.

## 5. Núcleo: ferramentas (MVP)

### 5.1 Organização e estrutura

- Cadastro com e-mail/senha e magic link; criação da primeira organização (nome, CNPJ opcional, slug). ✅ Fase 0.
- Unidades (plantas) e **locais** hierárquicos (Almoxarifado Central › Armário 3 › Prateleira B), setores e cargos.
- `create_organization` cria uma unidade e um local padrão ("Almoxarifado").
- Convite de membros por e-mail com papel.
- Configurações da organização: prefixo do código das ferramentas (padrão `FER`), horário de fim de turno (padrão 17:00, usado como previsão de devolução rápida), dias para considerar equipamento parado (padrão 60).

### 5.2 Funcionários

- Campos: nome, matrícula, CPF (opcional, validado, único por organização quando informado), cargo, setor, unidade, data de admissão e desligamento, telefone e e-mail opcionais, foto opcional.
- Cada funcionário tem um **token de crachá** para QR; crachás imprimíveis em PDF.
- Importação via CSV com pré-visualização e relatório de erros por linha.
- Perfil: ferramentas em posse agora (com atraso destacado), histórico de retiradas, ocorrências (perdas/avarias em que esteve envolvido).
- Desligamento: marca a data e lista as ferramentas em posse para devolução; não apaga histórico. Funcionário desligado não pode retirar.

### 5.3 Cadastro de ferramentas

- Cada **unidade física** é um registro próprio (duas furadeiras iguais = dois cadastros). Cadastro em lote: "criar N unidades iguais" gera N registros com códigos sequenciais.
- Campos: nome, categoria, **código interno** (gerado automaticamente `FER-00001`, editável, único na organização), **código de patrimônio** (opcional, único quando informado), fabricante, modelo, número de série, foto(s), valor de referência (BRL), data de aquisição, local de guarda, observações.
- **QR Code**: cada ferramenta tem um token aleatório; o QR contém `https://<app>/t/<token>`. Escanear com a câmera do celular abre a ferramenta. Token pode ser regenerado (etiqueta perdida ou copiada) e a etiqueta antiga para de funcionar.
- Etiquetas em PDF (folha A4 com várias etiquetas; nome, código interno e QR).
- Categorias definidas pela organização, com previsão de devolução padrão opcional.
- Arquivar em vez de excluir.

### 5.4 Status

| Status       | Significado                                 | Como entra                                               |
| ------------ | ------------------------------------------- | -------------------------------------------------------- |
| `disponivel` | No local de guarda, pode ser retirada       | cadastro, devolução em bom estado, retorno de manutenção |
| `em_uso`     | Com um funcionário                          | retirada                                                 |
| `manutencao` | Em manutenção/calibração interna ou externa | envio para manutenção                                    |
| `danificada` | Avariada, aguardando decisão                | devolução com avaria ou registro de avaria               |
| `perdida`    | Paradeiro desconhecido                      | registro de perda                                        |
| `descartada` | Baixada do patrimônio (final)               | descarte (owner/admin)                                   |

O status nunca é editado diretamente; ele muda por ação (retirar, devolver, enviar para manutenção...) e cada mudança fica no histórico. Transições válidas estão na skill `ferramentas-retirada`.

### 5.5 Retirada (fluxo principal — precisa ser MUITO rápido)

- **Modo balcão** (celular ou tablet no almoxarifado): escaneia o QR da ferramenta → sistema mostra a ferramenta e o status → escaneia o crachá (ou busca o funcionário) → escolhe a previsão de devolução (fim do turno, amanhã, 7 dias, data, sem previsão) → confirmar.
- Várias ferramentas numa mesma retirada (escaneia uma atrás da outra).
- Registra: funcionário, setor (o do funcionário, editável), data e hora, **responsável pela liberação** (usuário logado), previsão de devolução, observação, foto opcional.
- Bloqueios: ferramenta não disponível, funcionário desligado ou arquivado.
- Meta: **retirada de 1 ferramenta em < 10 s**.

### 5.6 Devolução

- No balcão: escaneia a ferramenta em uso → sistema já mostra quem está com ela e desde quando → escolhe condição (`bom`, `desgastado`, `danificado`) → foto opcional (obrigatória se danificado) → observação → confirmar.
- Condição `danificado` leva a ferramenta para `danificada`; as demais, para `disponivel` no local de guarda.
- Devolução em lote: todas as ferramentas de um funcionário de uma vez (a partir do perfil dele).
- Quem recebe a devolução é registrado.

### 5.7 Ocorrências e manutenção

- Registrar **perda** (fecha a retirada aberta, se houver, com o funcionário responsável), **avaria** (sem retirada) e **ferramenta localizada** (volta de perdida para disponível).
- **Manutenção**: abrir (tipo preventiva/corretiva/calibração, fornecedor em texto livre, descrição), fechar (resultado reparada/sem conserto, custo opcional, observação). Sem conserto → segue para descarte.
- **Descarte**: motivo obrigatório; só owner/admin.
- Todas as ações registram usuário, data/hora e observação no histórico.

### 5.8 Histórico

- Por ferramenta: linha do tempo com todos os eventos (cadastro, retiradas e devoluções com funcionário e condição, manutenções, perdas, mudanças de local), total de utilizações, tempo médio de uso, última utilização, fotos.
- Por funcionário: tudo o que retirou, devoluções em atraso, ocorrências.
- Retiradas: abertas, atrasadas, histórico filtrável por período, setor, funcionário, categoria.

### 5.9 Dashboard

| Indicador                         | Regra                                                     |
| --------------------------------- | --------------------------------------------------------- |
| Total de ferramentas              | ativas (não arquivadas, não descartadas)                  |
| Disponíveis / em uso / manutenção | contagem por status                                       |
| **Atrasadas**                     | retirada aberta com previsão de devolução vencida         |
| Perdidas / danificadas            | contagem por status                                       |
| Valor do patrimônio               | soma do valor de referência das ferramentas ativas        |
| Funcionários com mais ferramentas | ranking de retiradas abertas                              |
| Setores com maior uso             | retiradas por setor no período                            |
| Equipamentos parados              | disponíveis sem retirada há mais de N dias (configurável) |

Mais a lista "o que fazer hoje": atrasadas, danificadas aguardando decisão, manutenções abertas há muito tempo.

### 5.10 Alertas

- Central de alertas no app: ferramenta atrasada, ferramenta danificada aguardando decisão, manutenção aberta há mais de N dias, equipamento parado (informativo).
- Resumo diário por e-mail para owner, admin e storekeeper (configurável por usuário). Não envia e-mail vazio.
- Pós-MVP: notificação push no PWA, WhatsApp.

### 5.11 Relatórios (PDF e CSV)

- Ferramentas por status/local/categoria (inventário de patrimônio).
- Retiradas no período; atrasos; perdas e avarias por funcionário e setor.
- Histórico completo de uma ferramenta.

### 5.12 Mobile (PWA)

- Instalável na tela inicial (Android e iOS), abre em tela cheia.
- Leitura de QR pela câmera dentro do app; QR também funciona com a câmera nativa do celular (abre a URL).
- Telas do balcão pensadas para uso em pé, com luva: botões grandes, poucos passos, confirmação clara (som/vibração opcional).
- MVP exige conexão; sem conexão, mostrar aviso claro. Modo offline fica para depois.

## 6. Módulos seguintes (pós-MVP)

### 6.1 Estoque de materiais (v1.1)

- Cadastro de materiais de consumo (itens com quantidade, não unidade física): nome, código, unidade de medida, variações (tamanho), estoque mínimo, localização.
- Fornecedores (nome, CNPJ opcional, contato). Sem pedido de compra nem financeiro.
- Movimentações: entrada, saída para consumo (funcionário/setor), ajuste, inventário, descarte, estorno. Saldo derivado do ledger, nunca negativo.
- Estoque mínimo → alerta. Custo médio ponderado para relatório de consumo por setor.

### 6.2 Solicitações (v1.2)

- Funcionário (via almoxarife ou, depois, autoatendimento) solicita ferramenta/material → gestor (`manager`) aprova ou rejeita → almoxarifado atende (a retirada ou saída de estoque é gerada a partir da solicitação) → tudo registrado.
- Status: `pendente`, `aprovada`, `rejeitada`, `atendida`, `cancelada`.

## 7. Módulos SST (pós-MVP)

Reaproveitam funcionários, cargos, locais e o estoque do módulo 6.1 (EPI é um tipo de item de estoque).

### 7.1 Catálogo de EPIs

- EPI = item de estoque com campos extras: categoria de proteção, **número do CA**, **validade do CA**, **vida útil em dias** (para calcular a próxima troca), tamanhos.
- Alerta de CA vencido ou a vencer. Entrega de EPI com CA vencido exige confirmação explícita e fica na auditoria.
- CA digitado manualmente; integração com base pública fica para depois.

### 7.2 Matriz cargo → exigências

- Cada cargo define EPIs obrigatórios (com quantidade) e treinamentos obrigatórios.
- Status de conformidade do funcionário: `ok`, `atencao` (vence em ≤ 30 dias), `irregular` (vencido ou faltando).

### 7.3 Entregas de EPI

- Balcão: funcionário → sugestões pela matriz do cargo e trocas vencidas → itens e motivo (`primeira_entrega`, `troca_vencimento`, `troca_dano`, `perda`, `novo_cargo`) → confirmar.
- Assinatura na tela ou por link com token de uso único (72 h). Grava PNG, data/hora, IP, user-agent e hash SHA-256 do conteúdo.
- Termo de responsabilidade configurável pela organização.
- Devolução com destino `estoque` ou `descarte`. Próxima troca = data de entrega + vida útil.
- **Ficha de EPI** em PDF por funcionário. CPF passa a ser obrigatório para gerar a ficha.

### 7.4 Treinamentos

- Tipos: nome, NR, carga horária, validade em meses (nulo = sem vencimento fixo), cargos que exigem.
- Registro individual ou em turma, com certificado (PDF/imagem).
- Status: `valido`, `a_vencer`, `vencido`, `pendente`.
- Seeds editáveis de tipos comuns (NR-05, NR-06, NR-10, NR-11, NR-12, NR-20, NR-33, NR-35), com o aviso "Confirme os prazos com o responsável técnico."

### 7.5 Alertas e relatórios SST

CA vencendo, troca de EPI vencida, treinamento a vencer/vencido/pendente, assinatura pendente; relatórios de conformidade, matriz de treinamentos, dossiê de fiscalização.

## 8. Preparação para IA (sem implementar)

O MVP não tem IA. A preparação é ter dados limpos e completos:

- Fotos de ferramentas guardadas com tipo (cadastro, devolução, avaria) e vínculo à ferramenta → base para identificação por imagem.
- Histórico de eventos completo e estruturado → previsão de manutenção, análise de perdas.
- Movimentações de estoque com consumo por setor → previsão de reposição.
- Categorias e campos normalizados → busca inteligente (pgvector) no futuro.

## 9. Planos (futuro)

Cobrança por faixa de ferramentas ativas e/ou funcionários ativos. Trial de 14 dias. Deixe o modelo de dados preparado (`organizations.plan`), sem implementar cobrança no MVP.

## 10. Requisitos não funcionais

- Balcão usável no celular e em tablet; retirada ou devolução de 1 ferramenta em < 10 s.
- Páginas principais < 2 s em 4G.
- Acessibilidade: contraste AA, navegação por teclado, labels em todos os campos, alvos de toque ≥ 44 px.
- Backup: padrão do Supabase + exportação completa em CSV por organização.
- Log de auditoria para toda mutação relevante.
- Tudo em pt-BR, datas dd/MM/yyyy.

## 11. Métricas de sucesso do MVP

- 3 empresas usando por 30 dias seguidos.
- ≥ 90% das retiradas registradas pelo QR (não por busca manual).
- Nenhuma ferramenta "em uso" sem funcionário responsável.
- Almoxarife encontra quem está com qualquer ferramenta em < 3 cliques.

## 12. Fora de escopo

NF-e, financeiro, pedido de compra, vendas, depreciação contábil, folha, ponto, eSocial, exames médicos (ASO/PCMSO), rastreamento por GPS/RFID, app nativo no MVP. Anotar pedidos de clientes sobre isso em `docs/DECISIONS.md` para avaliar depois.
