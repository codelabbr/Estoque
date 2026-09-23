---
name: ui-design-system
description: Use ao criar ou alterar qualquer tela ou componente do Almox SST. Define layout, componentes shadcn, cores de status, textos em pt-BR, responsividade e acessibilidade.
---

# Design system

## Princípios

1. **Balcão primeiro.** Retirada e devolução acontecem em pé, com pressa, às vezes de luva, em tablet ou celular. Alvos de toque ≥ 44 px (≥ 56 px no modo balcão), poucos passos, scan antes de digitar.
2. **Status visível.** Em um olhar: onde está, com quem, se está atrasada.
3. **Sóbrio e confiável.** É um produto de controle de patrimônio: nada de visual "brincalhão".

## Base

- shadcn/ui (`radix-nova`, primitivos `Field*` para formulários — ver `docs/DECISIONS.md`), Tailwind v4, ícones lucide-react, fonte Inter (via `next/font`).
- Tokens em CSS variables no `globals.css`; tema claro e escuro.
- Cor primária: azul petróleo. Evite laranja/amarelo como primária para não confundir com alerta.

## Cores de status (use sempre o componente `<StatusBadge status=... />`)

### Ferramentas

| Status       | Rótulo     | Cor      | Ícone           |
| ------------ | ---------- | -------- | --------------- |
| `disponivel` | Disponível | verde    | `CheckCircle2`  |
| `em_uso`     | Em uso     | azul     | `UserRound`     |
| atrasada\*   | Atrasada   | vermelho | `AlarmClock`    |
| `manutencao` | Manutenção | âmbar    | `Wrench`        |
| `danificada` | Danificada | laranja  | `TriangleAlert` |
| `perdida`    | Perdida    | vermelho | `SearchX`       |
| `descartada` | Descartada | cinza    | `Archive`       |

\* "Atrasada" não é um status do banco: é `em_uso` + `is_overdue`. Mostre `Atrasada · 2 dias` no lugar de "Em uso".

### Genéricos (alertas, módulos SST)

| Status                  | Uso              | Cor           | Ícone           |
| ----------------------- | ---------------- | ------------- | --------------- |
| `ok` / `valido`         | em dia           | verde         | `CheckCircle2`  |
| `atencao` / `a_vencer`  | vence em breve   | âmbar         | `Clock`         |
| `irregular` / `vencido` | vencido/faltando | vermelho      | `AlertTriangle` |
| `pendente`              | aguardando ação  | cinza-azulado | `CircleDashed`  |

Nunca comunique status só por cor: sempre ícone + texto.

## Layout do app

- Sidebar (colapsável; vira `Sheet` no mobile), agrupada:
  - **Operação**: Dashboard, Balcão (destaque), Ferramentas, Retiradas, Funcionários, Manutenções
  - **Gestão**: Alertas (com contador), Relatórios
  - **Em breve** (só aparece quando o módulo existir): Materiais, Solicitações, EPIs, Treinamentos
  - Rodapé: Configurações
- Topo: seletor de organização, busca global (⌘K com `Command`: ferramenta por nome/código/patrimônio, funcionário), botão de scanner no mobile, menu do usuário.
- Mobile: barra inferior fixa com **Escanear** no centro (abre o balcão), Ferramentas, Retiradas, Menu.

## Componentes compartilhados (`src/components/shared/`)

`PageHeader`, `StatusBadge`, `DataTable` (TanStack, com versão card no mobile), `EmptyState`, `ConfirmDialog`, `DateDisplay` (dd/MM/yyyy + relativo "há 3 horas", "atrasada há 2 dias"), `CpfInput` (máscara), `PhoneInput`, `MoneyInput`, `EmployeePicker` (combobox com busca server-side), `ToolPicker`, `LocationPicker` (árvore), `QrScanner`, `PhotoCapture` (câmera traseira + compressão), `FileUpload` (drag & drop, preview, limite 10 MB), `Timeline` (histórico de eventos), `KpiCard`, `Can` (renderiza filhos conforme papel). Módulo EPI: `SignaturePad`, `ItemVariantPicker`.

## Fotos

Comprimir no cliente antes do upload: lado maior 1600 px, JPEG qualidade 0,8, remover EXIF (localização). Miniaturas por URL assinada com transformação do Supabase quando disponível.

## Textos

- pt-BR, frases curtas, voz ativa: "Retirada registrada", "Não foi possível salvar. Tente novamente."
- Botões com verbo: "Registrar retirada", "Confirmar devolução", "Imprimir etiquetas", "Salvar ferramenta".
- Datas `dd/MM/yyyy`; data e hora `dd/MM/yyyy 'às' HH:mm`; números `1.234,56`; moeda `R$ 1.234,56`.
- Mensagens de erro de campo abaixo do campo, em vermelho, específicas ("Código já usado por outra ferramenta", não "Campo inválido").

## Estados obrigatórios em toda tela

- Carregando: `Skeleton` com a forma do conteúdo (`loading.tsx`).
- Vazio: `EmptyState` com explicação e ação ("Nenhuma ferramenta cadastrada. Cadastre a primeira ou importe uma planilha.").
- Erro: `error.tsx` com botão "Tentar novamente".
- Sem permissão: mensagem clara, não tela em branco.
- Sem conexão (balcão): faixa fixa e ações desabilitadas.

## Acessibilidade

Contraste AA, foco visível, `label` em todo input, `aria-live` nos toasts e no resultado de cada leitura do scanner, navegação completa por teclado. Módulo EPI: `SignaturePad` com alternativa de "assinar digitando o nome" registrada como tipo diferente.

## Responsividade

Teste em 375px, 768px e 1280px. Tabelas viram cards abaixo de `md`. Formulários em 1 coluna no mobile, 2 no desktop.
