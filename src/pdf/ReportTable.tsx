import { Document, Page, Text, View } from "@react-pdf/renderer";
import { base, colors, DocFooter, DocHeader } from "./components/base";

export type ReportColumn = {
  header: string;
  flex?: number;
  align?: "left" | "right" | "center";
};

export type ReportTableData = {
  org: { name: string; legalName: string | null; cnpj: string | null };
  title: string;
  subtitle?: string;
  landscape?: boolean;
  columns: ReportColumn[];
  rows: string[][];
  summary?: string[];
  emittedAt: string;
  emittedBy: string;
  code: string;
};

/** Relatório tabular genérico (cabeçalho repetido a cada página). */
export function ReportTable({ data }: { data: ReportTableData }) {
  return (
    <Document title={data.title} author="Almox SST" language="pt-BR">
      <Page
        size="A4"
        orientation={data.landscape ? "landscape" : "portrait"}
        style={base.page}
      >
        <DocHeader
          orgName={data.org.name}
          legalName={data.org.legalName}
          cnpj={data.org.cnpj}
          title={data.title}
          subtitle={data.subtitle}
        />
        {data.summary && data.summary.length > 0 && (
          <View style={[base.section, { flexDirection: "row", gap: 16 }]}>
            {data.summary.map((s) => (
              <Text key={s} style={{ fontFamily: "Helvetica-Bold" }}>
                {s}
              </Text>
            ))}
          </View>
        )}
        <View style={base.section}>
          <View style={base.tableHeader} fixed>
            {data.columns.map((c) => (
              <Text
                key={c.header}
                style={[
                  base.th,
                  { flex: c.flex ?? 1, textAlign: c.align ?? "left" },
                ]}
              >
                {c.header}
              </Text>
            ))}
          </View>
          {data.rows.length === 0 && (
            <Text
              style={[
                base.td,
                {
                  color: colors.muted,
                  paddingVertical: 12,
                  textAlign: "center",
                },
              ]}
            >
              Nenhum registro.
            </Text>
          )}
          {data.rows.map((row, i) => (
            <View key={i} style={base.tableRow} wrap={false}>
              {row.map((value, j) => (
                <Text
                  key={j}
                  style={[
                    base.td,
                    {
                      flex: data.columns[j].flex ?? 1,
                      textAlign: data.columns[j].align ?? "left",
                    },
                  ]}
                >
                  {value}
                </Text>
              ))}
            </View>
          ))}
        </View>
        <DocFooter
          emittedAt={data.emittedAt}
          emittedBy={data.emittedBy}
          code={data.code}
        />
      </Page>
    </Document>
  );
}
