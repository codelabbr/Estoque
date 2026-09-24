/**
 * Resumo diário (HTML de e-mail com estilos inline, renderizado no servidor).
 * Seções por tipo com no máximo 10 itens cada e link "Ver todos".
 */
export type DigestItem = {
  title: string;
  kindLabel: string;
  due: string | null;
  critical: boolean;
};
export type DigestSection = {
  label: string;
  items: DigestItem[];
  total: number;
};

const font =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

export function DailyDigest({
  orgName,
  criticalCount,
  attentionCount,
  sections,
  alertsUrl,
  settingsUrl,
}: {
  orgName: string;
  criticalCount: number;
  attentionCount: number;
  sections: DigestSection[];
  alertsUrl: string;
  settingsUrl: string;
}) {
  const headline =
    criticalCount > 0
      ? `${criticalCount} ${criticalCount === 1 ? "item crítico" : "itens críticos"} hoje`
      : `${attentionCount} ${attentionCount === 1 ? "item pede" : "itens pedem"} atenção`;
  return (
    <html lang="pt-BR">
      <body
        style={{
          margin: 0,
          background: "#f7f9f9",
          fontFamily: font,
          color: "#0f1419",
        }}
      >
        <table
          width="100%"
          cellPadding={0}
          cellSpacing={0}
          role="presentation"
          style={{ background: "#f7f9f9", padding: "24px 0" }}
        >
          <tbody>
            <tr>
              <td align="center">
                <table
                  width="560"
                  cellPadding={0}
                  cellSpacing={0}
                  role="presentation"
                  style={{
                    maxWidth: 560,
                    width: "100%",
                    background: "#ffffff",
                    borderRadius: 16,
                    border: "1px solid #eff3f4",
                  }}
                >
                  <tbody>
                    <tr>
                      <td style={{ padding: "24px 28px 8px" }}>
                        <p
                          style={{ margin: 0, fontSize: 13, color: "#536471" }}
                        >
                          Almox SST · {orgName}
                        </p>
                        <h1
                          style={{
                            margin: "8px 0 4px",
                            fontSize: 24,
                            fontWeight: 800,
                          }}
                        >
                          {headline}
                        </h1>
                        <p
                          style={{ margin: 0, fontSize: 15, color: "#536471" }}
                        >
                          {criticalCount} críticos · {attentionCount} em atenção
                        </p>
                      </td>
                    </tr>
                    {sections.map((s) => (
                      <tr key={s.label}>
                        <td style={{ padding: "16px 28px 0" }}>
                          <h2
                            style={{
                              margin: "0 0 8px",
                              fontSize: 16,
                              fontWeight: 800,
                            }}
                          >
                            {s.label} ({s.total})
                          </h2>
                          <table
                            width="100%"
                            cellPadding={0}
                            cellSpacing={0}
                            role="presentation"
                          >
                            <tbody>
                              {s.items.map((it, i) => (
                                <tr key={i}>
                                  <td
                                    style={{
                                      padding: "8px 0",
                                      borderTop: "1px solid #eff3f4",
                                      fontSize: 14,
                                    }}
                                  >
                                    <span
                                      style={{
                                        color: it.critical
                                          ? "#c0152f"
                                          : "#8a5a00",
                                        fontWeight: 700,
                                      }}
                                    >
                                      {it.critical ? "● " : "○ "}
                                    </span>
                                    <strong>{it.title}</strong>
                                    <br />
                                    <span
                                      style={{ color: "#536471", fontSize: 13 }}
                                    >
                                      {it.kindLabel}
                                      {it.due ? ` · ${it.due}` : ""}
                                    </span>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                          {s.total > s.items.length && (
                            <p style={{ margin: "6px 0 0", fontSize: 13 }}>
                              <a href={alertsUrl} style={{ color: "#367c14" }}>
                                Ver todos ({s.total})
                              </a>
                            </p>
                          )}
                        </td>
                      </tr>
                    ))}
                    <tr>
                      <td style={{ padding: "24px 28px" }}>
                        <a
                          href={alertsUrl}
                          style={{
                            display: "inline-block",
                            background: "#367c14",
                            color: "#ffffff",
                            padding: "12px 22px",
                            borderRadius: 999,
                            fontWeight: 700,
                            fontSize: 15,
                            textDecoration: "none",
                          }}
                        >
                          Abrir a central de alertas
                        </a>
                      </td>
                    </tr>
                  </tbody>
                </table>
                <p
                  style={{ fontSize: 12, color: "#536471", margin: "16px 0 0" }}
                >
                  Você recebe este resumo porque é responsável por {orgName}.{" "}
                  <a href={settingsUrl} style={{ color: "#536471" }}>
                    Desativar o resumo diário
                  </a>
                </p>
              </td>
            </tr>
          </tbody>
        </table>
      </body>
    </html>
  );
}
