# PRD — Almox SST

## 1. Problema

Pequenas e médias indústrias precisam, por lei, registrar a entrega de EPIs (NR-6), manter EPIs com Certificado de Aprovação (CA) válido e garantir que cada funcionário tenha os treinamentos obrigatórios em dia para as atividades que executa. Na prática isso vive em planilhas e fichas de papel: fichas se perdem, estoque não bate, certificados vencem sem aviso. O risco é multa em fiscalização, passivo trabalhista e, principalmente, acidente.

## 2. Proposta de valor

"Saiba em 10 segundos se cada funcionário está com EPI e treinamento em dia — e prove isso na fiscalização."

## 3. Personas

| Persona                              | Descrição                                                              | O que precisa                                                |
| ------------------------------------ | ---------------------------------------------------------------------- | ------------------------------------------------------------ |
| **Técnico de Segurança** (principal) | Responsável por SST, às vezes terceirizado e atendendo várias empresas | Visão de pendências, fichas prontas para auditoria, alertas  |
| **Almoxarife**                       | Entrega EPIs no balcão                                                 | Entregar rápido, saber o saldo, registrar entrada de compras |
| **RH / Gestor**                      | Admite e desliga funcionários, acompanha custos                        | Cadastro de funcionários, relatórios, custo de EPI por setor |
| **Funcionário**                      | Recebe EPI e faz treinamentos                                          | Assinar o recebimento em segundos, sem precisar de conta     |

## 4. Papéis e permissões

| Papel                           | Permissões                                                   |
| ------------------------------- | ------------------------------------------------------------ |
| `owner`                         | Tudo, incluindo plano, cobrança e excluir organização        |
| `admin`                         | Tudo exceto cobrança e excluir organização; gerencia membros |
| `safety` (técnico de segurança) | CRUD de EPIs, treinamentos, entregas, estoque, relatórios    |
| `storekeeper` (almoxarife)      | Entradas de estoque, entregas, consulta de funcionários      |
| `viewer`                        | Somente leitura, incluindo relatórios                        |

Um usuário pode ser membro de várias organizações (técnico terceirizado). O funcionário **não é usuário do sistema**; assina via link/token ou na tela do almoxarifado.

## 5. Módulos e requisitos

### 5.1 Organização e conta

- Cadastro com e-mail/senha e magic link; criação da primeira organização (razão social, CNPJ opcional, slug).
- Convite de membros por e-mail com papel.
- Troca de organização no topo da tela.
- Unidades/plantas (opcional, uma organização pode ter várias) e setores.

### 5.2 Funcionários

- Campos: nome, CPF (validado, único por organização), matrícula, cargo/função, setor, unidade, data de admissão, data de desligamento, telefone (para envio de link de assinatura), e-mail opcional, foto opcional.
- Importação via CSV com pré-visualização e relatório de erros por linha.
- Perfil do funcionário: EPIs em posse (com vencimento de troca), histórico de entregas, treinamentos e status, pendências.
- Desligamento: marca data, lista EPIs em posse para devolução; não apaga histórico.
- **Status de conformidade** calculado: `ok`, `atencao` (algo vence em ≤30 dias), `irregular` (algo vencido ou EPI obrigatório não entregue).

### 5.3 Cargos/funções e matriz de exigências

- Cada cargo define **EPIs obrigatórios** (com quantidade) e **treinamentos obrigatórios**.
- Ex.: "Eletricista" → luva isolante, botina sem biqueira de aço, capacete classe B; NR-10 Básico, NR-35.
- A conformidade do funcionário é calculada comparando a matriz do cargo com o que ele tem.

### 5.4 Catálogo de EPIs

- Campos: nome, categoria (proteção da cabeça, olhos e face, auditiva, respiratória, tronco, membros superiores, membros inferiores, corpo inteiro, contra quedas), fabricante, modelo, **número do CA**, **validade do CA**, unidade (par, unidade, caixa), tamanhos/variações (P, M, G, 38, 40…), **vida útil em dias** (para calcular a próxima troca), estoque mínimo por variação, custo unitário de referência, foto.
- Alerta quando o CA estiver vencido ou a vencer. Bloquear (com confirmação explícita e registro) entrega de EPI com CA vencido.
- Consulta do CA: campo manual no MVP. Integração com base pública de CAs fica para depois (anotar em `DECISIONS.md`).

### 5.5 Estoque

- Estoque por **variação de EPI** e por **local** (almoxarifado). MVP: um local padrão por unidade.
- Tipos de movimentação: `entrada` (compra), `saida_entrega`, `devolucao` (volta ao estoque se reaproveitável), `descarte`, `ajuste_positivo`, `ajuste_negativo` (inventário), `transferencia` (fase 2), `estorno`.
- Entrada: fornecedor (texto livre), número do documento (texto livre, não é NF-e integrada), data, itens, quantidade, custo unitário, lote e validade do lote opcionais.
- Saldo atual por variação/local; saldo nunca negativo (bloquear no banco).
- Estoque mínimo → alerta; sugestão de compra = (mínimo − saldo) + trocas previstas nos próximos 30 dias.
- Inventário: tela de contagem que gera ajustes com motivo obrigatório.
- Custo médio ponderado por variação (para relatório de custo).

### 5.6 Entregas de EPI (fluxo principal — precisa ser MUITO rápido)

- Tela de balcão: buscar funcionário (nome, CPF, matrícula ou QR do crachá) → ver o que ele tem e o que está pendente → adicionar itens (sugestões com base na matriz do cargo e nas trocas vencidas) → escolher motivo (`primeira_entrega`, `troca_vencimento`, `troca_dano`, `perda`, `novo_cargo`) → confirmar.
- Assinatura: (a) na tela, com o dedo/caneta, ou (b) link enviado por WhatsApp/SMS/e-mail com token de uso único, válido por 72h. Assinatura grava imagem PNG, data/hora, IP, user-agent e hash SHA-256 do conteúdo da entrega.
- Texto de declaração exibido antes de assinar (termo de responsabilidade de uso, guarda e conservação do EPI, configurável pela organização).
- Entrega com assinatura pendente fica visível na lista de pendências.
- Devolução: registra a devolução, destino (`estoque` ou `descarte`) e, se for ao estoque, gera movimentação de entrada.
- Gera a **Ficha de EPI** em PDF por funcionário, com todas as entregas e assinaturas.
- Próxima troca calculada = data de entrega + vida útil do EPI.

### 5.7 Treinamentos

- Tipos de treinamento: nome, NR relacionada, carga horária, **validade em meses** (nulo = sem vencimento fixo), obrigatório para quais cargos.
- Registro de treinamento por funcionário: data de realização, data de validade (calculada, editável), instrutor/entidade, carga horária, certificado (upload PDF/imagem no Storage).
- Registro em lote: uma turma com vários funcionários de uma vez.
- Status: `valido`, `a_vencer` (≤ N dias, configurável, padrão 30/60), `vencido`, `pendente` (exigido pelo cargo e nunca feito).
- Seeds de tipos comuns (NR-05 CIPA, NR-06, NR-10 Básico, NR-10 SEP, NR-11, NR-12, NR-20, NR-33 Trabalhador/Vigia, NR-33 Supervisor, NR-35) com validades **editáveis** e uma nota na interface: "Confirme os prazos com o responsável técnico; eles podem variar conforme a norma e a atividade."

### 5.8 Alertas

- Tipos: CA vencendo/vencido, troca de EPI prevista/vencida, treinamento a vencer/vencido/pendente, estoque abaixo do mínimo, assinatura pendente há mais de X horas.
- Central de alertas no app com filtros e ação de "resolver"/"adiar".
- Resumo diário por e-mail para membros com papel `owner`, `admin` ou `safety` (configurável por usuário). Não enviar e-mail vazio.
- Fase 2: WhatsApp.

### 5.9 Dashboard

- Cards: % funcionários conformes, treinamentos vencidos, trocas de EPI vencidas, itens abaixo do mínimo, assinaturas pendentes.
- Lista "o que fazer hoje" ordenada por gravidade.
- Gráfico de consumo de EPI por mês e custo por setor.

### 5.10 Relatórios (PDF e CSV)

- Ficha de EPI por funcionário.
- Relatório de conformidade por setor/cargo.
- Vencimentos (treinamentos e EPIs) no período.
- Movimentações de estoque no período; posição de estoque; custo de EPI por setor/funcionário.
- Dossiê de fiscalização: pacote com fichas + certificados de um funcionário ou setor.

### 5.11 Configurações

- Dados da organização, logo (usado nos PDFs), texto do termo de responsabilidade, antecedência dos alertas, membros e papéis, unidades, setores, cargos.

### 5.12 Planos (fase 3)

- Cobrança por faixa de funcionários ativos (ex.: até 50, até 150, até 500). Trial de 14 dias. Stripe ou Asaas. Deixe o modelo de dados preparado (`organizations.plan`, `plan_limits`), sem implementar cobrança no MVP.

## 6. Requisitos não funcionais

- Tela de entrega usável no celular e em tablet de balcão; entrega completa em < 30 s.
- Páginas principais < 2 s em 4G.
- Acessibilidade: contraste AA, navegação por teclado, labels em todos os campos.
- Backup: padrão do Supabase + exportação completa em CSV por organização.
- Logs de auditoria para toda mutação relevante.
- Tudo em pt-BR, datas dd/MM/yyyy.

## 7. Métricas de sucesso do MVP

- 3 empresas usando por 30 dias seguidos.
- ≥ 80% das entregas com assinatura concluída em até 24 h.
- Técnico consegue gerar a ficha de EPI de qualquer funcionário em < 3 cliques.

## 8. Fora de escopo

NF-e, financeiro, compras com aprovação, folha, ponto, eSocial (S-2240/S-2220), exames médicos (ASO/PCMSO), app nativo. Anotar pedidos de clientes sobre isso em `docs/DECISIONS.md` para avaliar depois.
