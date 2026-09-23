// @vitest-environment node
import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { DailyDigest } from "../DailyDigest";

describe("DailyDigest", () => {
  it("mostra contagem de críticos, seções e link para desativar", () => {
    const html = renderToStaticMarkup(
      createElement(DailyDigest, {
        orgName: "Aço Peças",
        criticalCount: 3,
        attentionCount: 2,
        sections: [
          {
            label: "Treinamentos",
            total: 12,
            items: [
              {
                title: "NR-35 · Ana Souza",
                kindLabel: "Treinamento vencido",
                due: "venceu há 3 dias",
                critical: true,
              },
            ],
          },
        ],
        alertsUrl: "https://app/x/alertas",
        settingsUrl: "https://app/x/alertas#resumo",
      }),
    );
    expect(html).toContain("3 itens críticos hoje");
    expect(html).toContain("Treinamentos (12)");
    expect(html).toContain("Ver todos (12)");
    expect(html).toContain("Desativar o resumo diário");
  });
});
