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
};

/** Mapeia erros do Postgres/Supabase para mensagens em pt-BR, claras e sem jargão técnico. */
export function mapDbError(error: DbErrorLike): string {
  const message = error.message ?? "";

  for (const [code, friendly] of Object.entries(BUSINESS_ERROR_MESSAGES)) {
    if (message.includes(code)) return friendly;
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
