---
name: treinamentos-nr
description: Use ao trabalhar com treinamentos obrigatórios no Almox SST — tipos de treinamento, validade, certificados, turmas, status e conformidade do funcionário por cargo.
---

# Treinamentos e NRs

## Aviso importante

Prazos de reciclagem variam conforme a norma, sua versão vigente e a atividade. O sistema **não decide** o que a lei exige: ele guarda a validade configurada pela empresa. Os seeds são sugestões editáveis, e a interface mostra: "Confirme os prazos com o responsável técnico."

## Seeds sugeridos (criados em `create_organization`, todos editáveis)

| Nome                                                                                                         | NR    | Validade sugerida (meses)              |
| ------------------------------------------------------------------------------------------------------------ | ----- | -------------------------------------- |
| NR-05 CIPA                                                                                                   | NR-05 | 12                                     |
| NR-06 Uso de EPI                                                                                             | NR-06 | null                                   |
| NR-10 Básico                                                                                                 | NR-10 | 24                                     |
| NR-10 SEP                                                                                                    | NR-10 | 24                                     |
| NR-11 Operador de empilhadeira                                                                               | NR-11 | 12                                     |
| NR-12 Máquinas e equipamentos                                                                                | NR-12 | null                                   |
| NR-20 Inflamáveis                                                                                            | NR-20 | null (depende da classe da instalação) |
| NR-33 Trabalhador/Vigia                                                                                      | NR-33 | 12                                     |
| NR-33 Supervisor                                                                                             | NR-33 | 12                                     |
| NR-35 Trabalho em altura                                                                                     | NR-35 | 24                                     |
| `null` = sem vencimento fixo; o registro continua válido até a empresa informar uma data de validade manual. |

## Regras

- `expires_at` = `completed_at + validity_months` (calculado na action, editável pelo usuário com aviso).
- Status (na view `v_employee_training_status`), considerando o **registro mais recente** por (funcionário, tipo):
  - `vencido`: `expires_at < current_date`
  - `a_vencer`: `expires_at <= current_date + org.alert_days_training`
  - `valido`: demais, ou `expires_at is null`
  - `pendente`: tipo exigido pelo cargo do funcionário (`job_role_training_requirements`) sem nenhum registro.
- Registro antigo nunca é apagado ao registrar reciclagem; o novo simplesmente vira o mais recente.
- `completed_at` não pode ser no futuro; certificado é recomendado, não obrigatório (mostrar badge "sem certificado").

## Conformidade do funcionário (`v_employee_compliance`)

`irregular` se houver treinamento `vencido`/`pendente` ou EPI obrigatório do cargo nunca entregue / troca vencida; `atencao` se houver algo `a_vencer`; senão `ok`. `issues` = array jsonb com `{kind, label, due_date}` para exibir no perfil e no dashboard. Funcionários desligados não entram.

## Telas

- **Tipos de treinamento**: CRUD + vínculo com cargos.
- **Registrar treinamento**: individual (a partir do perfil) ou **turma**: escolhe o tipo, data, instrutor/entidade, carga horária, seleciona vários funcionários (com filtro "quem está vencido/pendente neste treinamento"), certificado único da turma ou um por pessoa.
- **Matriz**: tabela funcionários × treinamentos com células coloridas por status (`StatusBadge` compacto) — é a tela que o técnico mais vai usar para planejar turmas. Exportável em CSV/PDF.

## Certificados

Upload para `certificates/{org}/{employee}/{training}.{ext}` (PDF/JPG/PNG, ≤ 10 MB). Visualização por URL assinada. Em turma com certificado único, grave o mesmo caminho em todos os registros.

## Testes

- Cálculo de validade (inclui fim de mês: 31/01 + 1 mês).
- Status para cada caso, incluindo pendente pela matriz.
- Reciclagem substitui status sem apagar histórico.
- Funcionário desligado fora da conformidade.
