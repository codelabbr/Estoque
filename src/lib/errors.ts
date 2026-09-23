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
