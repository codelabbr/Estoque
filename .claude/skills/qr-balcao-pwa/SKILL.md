---
name: qr-balcao-pwa
description: Use ao trabalhar com QR Codes (ferramenta e crachá), etiquetas impressas, scanner de câmera, leitor USB/Bluetooth, modo balcão (retirada e devolução rápidas) e PWA (manifest, instalação, service worker) no Almox SST.
---

# QR Code, modo balcão e PWA

## Formato dos QR Codes

| Tipo       | Conteúdo                        | Resolve para                   |
| ---------- | ------------------------------- | ------------------------------ |
| Ferramenta | `https://<app>/t/<qr_token>`    | `/<orgSlug>/ferramentas/<id>`  |
| Crachá     | `https://<app>/c/<badge_token>` | `/<orgSlug>/funcionarios/<id>` |

- Token: 16 bytes aleatórios em base64url (22 caracteres). Nunca o UUID.
- Por ser uma URL, a **câmera nativa** do celular já abre a página certa. Dentro do app, o scanner lê a mesma URL e age sem navegar.
- `/t/[token]` e `/c/[token]` são route handlers que chamam `resolve_scan(token)` com o client do usuário. Sem sessão → middleware manda para `/login?next=/t/<token>` (o `next` é validado por `safeNextPath`). Token inexistente, ou de uma org da qual o usuário não é membro → mesma página "QR não encontrado" (não revelar que existe em outra org).
- Parser único em `src/features/scanner/parse.ts`: aceita a URL com **qualquer host** (as etiquetas sobrevivem a troca de domínio) cujo caminho case `^/(t|c)/([A-Za-z0-9_-]{22})$`, e também o token puro (leitores configurados para só o conteúdo). Qualquer outra coisa → `{ kind: 'desconhecido' }` e toast "QR não reconhecido".

## Componente `QrScanner` (`src/components/shared/qr-scanner.tsx`, client)

- `getUserMedia({ video: { facingMode: 'environment' } })`.
- Detecção: `BarcodeDetector` com `formats: ['qr_code']` quando existir; senão `import('@zxing/browser')` sob demanda (não entra no bundle inicial).
- Lê ~8 quadros/s (não todo `requestAnimationFrame`) para poupar bateria.
- Ignora o mesmo conteúdo lido nos últimos 2 s (evita leitura dupla).
- Lanterna quando `track.getCapabilities().torch` existir.
- Para a câmera ao sair da página, ao trocar de aba (`visibilitychange`) e ao desmontar.
- Estados: pedindo permissão | lendo | permissão negada (instruções para liberar no navegador) | sem câmera → mostrar só a digitação manual.
- Câmera exige HTTPS. Em dev no celular: `next dev --experimental-https` ou um túnel; `localhost` funciona só no próprio computador.

**Entradas alternativas, sempre disponíveis:**

- **Leitor USB/Bluetooth** (age como teclado): campo focado invisível que junta os caracteres e processa no `Enter`. Muito usado em terminal fixo.
- **Digitação manual**: busca por código interno (`FER-00042`), patrimônio ou nome, para etiqueta danificada.

## Modo balcão (`/[orgSlug]/balcao`)

Tela cheia, pensada para tablet ou celular em pé, com luva. O **primeiro scan decide o modo**:

```
scan ferramenta
 ├─ disponivel  → modo RETIRADA: entra no carrinho
 │                 scans seguintes de ferramentas disponíveis entram no carrinho
 │                 scan de crachá (ou busca) → define o funcionário
 │                 folha de confirmação: funcionário, itens, previsão [Fim do turno | Amanhã | 7 dias | Data | Sem previsão]
 │                 [Confirmar retirada] → checkout_tools
 ├─ em_uso      → modo DEVOLUÇÃO: mostra "Com <nome> desde <hora>" (+ atraso)
 │                 scans seguintes de ferramentas em uso entram na lista
 │                 condição por item [Bom | Desgastado | Danificado] (danificado abre câmera para foto)
 │                 [Confirmar devolução] → return_tools
 └─ outro status → cartão vermelho com o motivo ("Em manutenção desde 12/09") e nenhuma ação
scan crachá primeiro → mostra o que o funcionário tem agora + "Devolver tudo" ou inicia RETIRADA para ele
```

- Scan de ferramenta de modo incompatível (ex.: em uso durante uma retirada) → toast explicando, não troca de modo sozinho.
- Retorno imediato a cada leitura: faixa verde/vermelha grande, `navigator.vibrate(60)` e bipe opcional (WebAudio, desligável nas configurações do aparelho, salvo em `localStorage`).
- Depois de confirmar: tela de sucesso por 2 s com resumo e volta ao scanner vazio. Botão "Desfazer" **não existe**: correção é uma nova ação (devolver o que foi retirado por engano), para manter o histórico honesto.
- Alvos de toque ≥ 56 px nesta tela; texto grande; nada de tabela.
- Meta: retirada de 1 ferramenta em < 10 s (scan ferramenta → scan crachá → confirmar).

## Etiquetas e crachás (PDF, skill `pdf-documentos`)

- Etiqueta de ferramenta: QR (nível de correção **M**, lado mínimo 20 mm, margem de silêncio de 4 módulos), nome curto, código interno em fonte grande, nome da organização.
- Formatos: folha A4 em grade (padrão 3 × 8; linhas, colunas e margens configuráveis para casar com a folha de etiquetas adesivas do cliente) e rolo de impressora térmica (1 etiqueta por página, padrão 50 × 25 mm).
- Imprimir: selecionadas na lista, uma ferramenta, ou "todas sem etiqueta impressa" (guarde `label_printed_at` se a demanda aparecer).
- Crachá: tamanho cartão (85,6 × 54 mm), foto opcional, nome, matrícula, setor, QR.
- Geração do QR com a lib `qrcode` (SVG → `@react-pdf` `Svg`/`Path`), no servidor.

## PWA

- `src/app/manifest.ts`: `name`, `short_name: 'Almox'`, `display: 'standalone'`, `start_url: '/'`, `theme_color` = primária, ícones 192 e 512 + versão `maskable`.
- iOS: `apple-touch-icon` e `appleWebApp` no `metadata` do layout raiz.
- Service worker mínimo em `public/sw.js`, registrado por um client component: só página offline de fallback. **Não** cachear páginas autenticadas nem respostas do Supabase (dado velho sobre quem está com a ferramenta é pior que nenhum dado). Não use plugins `next-pwa` (incompatíveis com turbopack).
- Sem conexão (`navigator.onLine` + eventos `online/offline`): faixa fixa "Sem conexão — retiradas e devoluções estão pausadas" e botões de confirmar desabilitados.
- Offline de verdade (fila local com sincronização) fica para depois do MVP e exige decisão em `DECISIONS.md` (conflitos de estado).

## Testes

- Unit (Vitest): `parse.ts` com URL de outro host, token puro, token com tamanho errado, texto aleatório, URL de outro caminho.
- Unit: cálculo das previsões de devolução (fim do turno já passado, virada de dia, fuso).
- pgTAP: `resolve_scan` não resolve token de outra org; token regenerado deixa de resolver.
- E2E (Playwright): balcão pela **entrada manual** e pelo **leitor-teclado** (digitar a URL + Enter) em viewport 375 px — câmera não é testada em CI.
- Manual antes do piloto: Android Chrome e iPhone Safari, instalado e não instalado, com pouca luz.
