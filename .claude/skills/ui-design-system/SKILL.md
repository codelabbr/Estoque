---
name: ui-design-system
description: Use ao criar ou alterar qualquer tela ou componente do Almox SST. Define layout, componentes shadcn, cores de status, textos em pt-BR, responsividade e acessibilidade.
---

# Design system

## Princípios

1. **Balcão primeiro.** A tela de entrega é usada em pé, com pressa, em tablet ou celular. Alvos de toque ≥ 44px, poucos passos, busca que aceita nome/CPF/matrícula.
2. **Status visível.** O usuário deve saber em um olhar o que está ok, em atenção ou irregular.
3. **Sóbrio e confiável.** É um produto de segurança e compliance: nada de visual "brincalhão".

## Base

- shadcn/ui (estilo `new-york`), Tailwind v4, ícones lucide-react, fonte Inter (via `next/font`).
- Tokens em CSS variables no `globals.css`; tema claro e escuro.
- Cor primária: azul petróleo (`--primary: oklch(0.45 0.09 230)`). Evite laranja/amarelo como primária para não confundir com alerta.

## Cores de status (use sempre o componente `<StatusBadge status=... />`)

| Status                                                   | Uso                                                   | Cor           | Ícone           |
| -------------------------------------------------------- | ----------------------------------------------------- | ------------- | --------------- |
| `ok` / `valido`                                          | em dia                                                | verde         | `CheckCircle2`  |
| `atencao` / `a_vencer`                                   | vence em breve                                        | âmbar         | `Clock`         |
| `irregular` / `vencido`                                  | vencido/faltando                                      | vermelho      | `AlertTriangle` |
| `pendente`                                               | aguardando ação (assinatura, treinamento nunca feito) | cinza-azulado | `CircleDashed`  |
| Nunca comunique status só por cor: sempre ícone + texto. |

## Layout do app

- Sidebar (colapsável; vira `Sheet` no mobile): Dashboard, Entregas (destaque), Funcionários, EPIs, Estoque, Treinamentos, Alertas (com contador), Relatórios, Configurações.
- Topo: seletor de organização, busca global (⌘K com `Command`: funcionário, EPI), menu do usuário.
- Botão flutuante "Nova entrega" no mobile.

## Componentes compartilhados (`src/components/shared/`)

`PageHeader`, `StatusBadge`, `DataTable` (TanStack, com versão card no mobile), `EmptyState`, `ConfirmDialog`, `DateDisplay` (dd/MM/yyyy + relativo "vence em 12 dias"), `CpfInput` (máscara), `PhoneInput`, `EmployeePicker` (combobox com busca server-side), `EpiVariantPicker`, `FileUpload` (drag & drop, preview, limite 10 MB, PDF/JPG/PNG), `SignaturePad`, `KpiCard`, `Can` (renderiza filhos conforme papel).

## Textos

- pt-BR, frases curtas, voz ativa: "Entrega registrada", "Não foi possível salvar. Tente novamente."
- Botões com verbo: "Registrar entrega", "Salvar funcionário", "Enviar link de assinatura".
- Datas `dd/MM/yyyy`; data e hora `dd/MM/yyyy 'às' HH:mm`; números `1.234,56`.
- Mensagens de erro de campo abaixo do campo, em vermelho, específicas ("CPF inválido", não "Campo inválido").

## Estados obrigatórios em toda tela

- Carregando: `Skeleton` com a forma do conteúdo (`loading.tsx`).
- Vazio: `EmptyState` com explicação e ação ("Nenhum EPI cadastrado. Cadastre o primeiro ou importe uma planilha.").
- Erro: `error.tsx` com botão "Tentar novamente".
- Sem permissão: mensagem clara, não tela em branco.

## Acessibilidade

Contraste AA, foco visível, `label` em todo input, `aria-live` nos toasts, navegação completa por teclado, `SignaturePad` com alternativa de "assinar digitando o nome" registrada como tipo diferente.

## Responsividade

Teste em 375px, 768px e 1280px. Tabelas viram cards abaixo de `md`. Formulários em 1 coluna no mobile, 2 no desktop.
