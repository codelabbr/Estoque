type DbErrorLike = {
  code?: string | null;
  message?: string | null;
  details?: string | null;
};

/** Mensagens pt-BR para códigos de negócio levantados por `raise exception '<codigo>'` no banco. */
const BUSINESS_ERROR_MESSAGES: Record<string, string> = {
  registro_imutavel: "Este registro não pode ser alterado ou excluído.",
  ultimo_owner_organizacao:
    "Não é possível remover ou rebaixar o último proprietário da organização.",
  permissao_negada: "Você não tem permissão para fazer isso.",
  nao_autenticado: "Sua sessão expirou. Faça login novamente.",
  saldo_insuficiente: "Saldo insuficiente em estoque para essa quantidade.",
  motivo_obrigatorio: "Informe o motivo (pelo menos 3 caracteres).",
  quantidade_invalida: "Informe uma quantidade válida.",
  local_invalido: "Local de estoque inválido ou arquivado.",
  item_invalido: "EPI ou tamanho inválido ou arquivado.",
  entrada_sem_itens: "Adicione pelo menos um item.",
  data_futura: "A data não pode ser no futuro.",
  movimento_ja_estornado: "Este movimento já foi estornado.",
  movimento_nao_estornavel:
    "Este tipo de movimento não pode ser estornado aqui. Saídas e devoluções são desfeitas pela entrega.",
  movimento_inexistente: "Movimento não encontrado.",
  funcionario_invalido: "Funcionário não encontrado ou arquivado.",
  funcionario_desligado: "Este funcionário está desligado.",
  entrega_sem_itens: "Adicione pelo menos um EPI à entrega.",
  item_duplicado:
    "O mesmo EPI e tamanho aparece duas vezes. Junte as quantidades.",
  ca_vencido:
    "Há EPI com CA vencido. Marque “Entregar mesmo assim” para confirmar ou escolha outro item.",
  entrega_inexistente: "Entrega não encontrada.",
  entrega_nao_cancelavel:
    "Só é possível cancelar entregas que ainda não foram assinadas.",
  cancelamento_fora_do_dia:
    "A entrega só pode ser cancelada no mesmo dia. Depois disso, registre a devolução.",
  entrega_com_devolucao:
    "Esta entrega já tem item devolvido e não pode ser cancelada.",
  entrega_nao_pendente: "Esta entrega não está mais aguardando assinatura.",
  entrega_cancelada: "Esta entrega foi cancelada.",
  token_invalido: "Link de assinatura inválido.",
  token_usado: "Este link já foi usado. A entrega já está assinada.",
  token_cancelado:
    "Este link foi substituído por um mais novo. Peça o link atualizado.",
  token_expirado: "Este link expirou. Peça um novo link a quem fez a entrega.",
  conteudo_alterado:
    "O conteúdo da entrega não confere com o registro original. Fale com o responsável.",
  assinatura_vazia: "Desenhe sua assinatura antes de confirmar.",
  item_ja_devolvido: "Este item já foi devolvido.",
  turma_sem_participantes: "Selecione pelo menos um participante.",
};

/** Mensagens para violações de constraints específicas (nome da constraint → texto). */
const CONSTRAINT_MESSAGES: Record<string, string> = {
  employees_organization_id_cpf_key: "Já existe um funcionário com este CPF.",
  employees_registration_key: "Já existe um funcionário com esta matrícula.",
  job_roles_organization_id_name_key: "Já existe um cargo com este nome.",
  units_organization_id_name_key: "Já existe uma unidade com este nome.",
  training_types_organization_id_name_key:
    "Já existe um tipo de treinamento com este nome.",
  epi_variants_epi_id_size_label_key: "Este EPI já tem esse tamanho.",
  job_role_epi_requirements_pkey: "Este EPI já está na lista do cargo.",
  job_role_training_requirements_pkey:
    "Este treinamento já está na lista do cargo.",
  organizations_slug_key: "Este identificador já está em uso. Escolha outro.",
};

/** Mapeia erros do Postgres/Supabase para mensagens em pt-BR, claras e sem jargão técnico. */
export function mapDbError(error: DbErrorLike): string {
  const message = error.message ?? "";

  for (const [code, friendly] of Object.entries(BUSINESS_ERROR_MESSAGES)) {
    if (message.includes(code)) return friendly;
  }
  for (const [constraint, friendly] of Object.entries(CONSTRAINT_MESSAGES)) {
    if (message.includes(constraint) || error.details?.includes(constraint)) {
      return friendly;
    }
  }

  switch (error.code) {
    case "23505":
      return "Já existe um registro com esses dados.";
    case "23503":
      return "Este registro está vinculado a outros dados e não pode ser alterado.";
    case "23514":
      return "Os dados informados não atendem às regras do sistema.";
    case "42501":
      return "Você não tem permissão para fazer isso.";
    case "28000":
      return "Sua sessão expirou. Faça login novamente.";
    default:
      return "Não foi possível salvar. Tente novamente.";
  }
}

/** Mensagens pt-BR para códigos de erro do Supabase Auth (`error.code`). */
const AUTH_ERROR_MESSAGES: Record<string, string> = {
  invalid_credentials: "E-mail ou senha incorretos.",
  email_not_confirmed:
    "Confirme seu e-mail antes de entrar. Verifique sua caixa de entrada.",
  user_already_exists: "Este e-mail já está cadastrado. Tente entrar.",
  email_exists: "Este e-mail já está cadastrado. Tente entrar.",
  weak_password: "A senha é muito fraca. Use pelo menos 8 caracteres.",
  same_password: "A nova senha precisa ser diferente da atual.",
  over_email_send_rate_limit:
    "Muitos e-mails enviados. Aguarde alguns minutos e tente novamente.",
  over_request_rate_limit:
    "Muitas tentativas. Aguarde alguns minutos e tente novamente.",
  email_address_not_authorized:
    "Não foi possível enviar e-mail para este endereço. Fale com o suporte.",
  email_address_invalid: "E-mail inválido.",
  signup_disabled: "Novos cadastros estão desativados no momento.",
  user_banned: "Este usuário está bloqueado. Fale com o administrador.",
  session_not_found: "Sua sessão expirou. Faça login novamente.",
  otp_expired: "Este link expirou. Solicite um novo.",
};

/** Mapeia erros do Supabase Auth para mensagens em pt-BR. Registra o erro original no servidor. */
export function mapAuthError(error: DbErrorLike & { status?: number }): string {
  const friendly = error.code ? AUTH_ERROR_MESSAGES[error.code] : undefined;
  if (friendly) return friendly;

  console.error("[auth] erro não mapeado", {
    code: error.code,
    status: error.status,
    message: error.message,
  });
  return "Não foi possível concluir. Tente novamente em instantes.";
}
