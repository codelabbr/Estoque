import { Document, Image, Page, Text, View } from "@react-pdf/renderer";
import { base, colors, DocFooter, DocHeader } from "./components/base";

export type EpiSheetData = {
  org: { name: string; legalName: string | null; cnpj: string | null };
  employee: {
    name: string;
    cpf: string;
    registration: string | null;
    jobRole: string | null;
    sector: string | null;
    hiredAt: string | null;
  };
  term: string;
  rows: {
    date: string;
    epi: string;
    size: string;
    quantity: number;
    ca: string | null;
    /** Validade do CA no momento da entrega (snapshot), já formatada. */
    caValidity: string | null;
    reason: string;
    returnedAt: string | null;
    signature:
      | { kind: "imagem"; dataUrl: string }
      | { kind: "nome"; name: string }
      | { kind: "pendente" };
    caOverride: boolean;
  }[];
  emittedAt: string;
  emittedBy: string;
  code: string;
};

const COLS = [
  { key: "date", label: "Data", width: 52 },
  { key: "epi", label: "EPI", width: 128 },
  { key: "size", label: "Tam.", width: 30 },
  { key: "quantity", label: "Qtd.", width: 26 },
  { key: "ca", label: "CA", width: 40 },
  { key: "reason", label: "Motivo", width: 72 },
  { key: "returned", label: "Devolução", width: 52 },
  { key: "signature", label: "Assinatura", width: 0 },
] as const;

/** Ficha de controle de EPI (NR-6): uma linha por item entregue, com o CA do momento da entrega. */
export function EpiSheet({ data }: { data: EpiSheetData }) {
  const e = data.employee;
  return (
    <Document
      title={`Ficha de EPI — ${e.name}`}
      author="Almox SST"
      language="pt-BR"
    >
      <Page size="A4" style={base.page}>
        <DocHeader
          orgName={data.org.name}
          legalName={data.org.legalName}
          cnpj={data.org.cnpj}
          title="Ficha de controle de EPI"
          subtitle="Registro de fornecimento de Equipamento de Proteção Individual (NR-6)"
        />

        <View
          style={[
            base.section,
            base.box,
            { flexDirection: "row", flexWrap: "wrap", gap: 6 },
          ]}
        >
          {[
            ["Funcionário", e.name],
            ["CPF", e.cpf],
            ["Matrícula", e.registration ?? "—"],
            ["Cargo", e.jobRole ?? "—"],
            ["Setor", e.sector ?? "—"],
            ["Admissão", e.hiredAt ?? "—"],
          ].map(([label, value]) => (
            <View
              key={label}
              style={{ width: label === "Funcionário" ? "48%" : "24%" }}
            >
              <Text style={[base.muted, { fontSize: 7.5 }]}>{label}</Text>
              <Text style={{ fontFamily: "Helvetica-Bold" }}>{value}</Text>
            </View>
          ))}
        </View>

        <View style={base.section}>
          <Text style={base.h2}>Termo de responsabilidade</Text>
          <Text style={{ lineHeight: 1.4 }}>{data.term}</Text>
        </View>

        <View style={base.section}>
          <View style={base.tableHeader} fixed>
            {COLS.map((c) => (
              <Text
                key={c.key}
                style={[base.th, c.width ? { width: c.width } : { flex: 1 }]}
              >
                {c.label}
              </Text>
            ))}
          </View>
          {data.rows.length === 0 && (
            <Text
              style={[
                base.td,
                base.muted,
                { paddingVertical: 12, textAlign: "center" },
              ]}
            >
              Nenhuma entrega registrada.
            </Text>
          )}
          {data.rows.map((r, i) => (
            <View key={i} style={base.tableRow} wrap={false}>
              <Text style={[base.td, { width: 52 }]}>{r.date}</Text>
              <Text style={[base.td, { width: 128 }]}>
                {r.epi}
                {r.caOverride ? " *" : ""}
              </Text>
              <Text style={[base.td, { width: 30 }]}>{r.size}</Text>
              <Text style={[base.td, { width: 26, textAlign: "center" }]}>
                {r.quantity}
              </Text>
              <Text style={[base.td, { width: 40 }]}>
                {r.ca ?? "—"}
                {r.caValidity ? `\nval. ${r.caValidity}` : ""}
              </Text>
              <Text style={[base.td, { width: 72 }]}>{r.reason}</Text>
              <Text style={[base.td, { width: 52 }]}>
                {r.returnedAt ?? "—"}
              </Text>
              <View
                style={[
                  base.td,
                  { flex: 1, height: 28, justifyContent: "center" },
                ]}
              >
                {r.signature.kind === "imagem" ? (
                  // eslint-disable-next-line jsx-a11y/alt-text -- Image do react-pdf não tem alt
                  <Image
                    src={r.signature.dataUrl}
                    style={{
                      height: 24,
                      objectFit: "contain",
                      objectPosition: "left",
                    }}
                  />
                ) : r.signature.kind === "nome" ? (
                  <Text style={{ fontFamily: "Helvetica-Oblique" }}>
                    {r.signature.name} (digitado)
                  </Text>
                ) : (
                  <Text style={{ color: colors.muted }}>Pendente</Text>
                )}
              </View>
            </View>
          ))}
          {data.rows.some((r) => r.caOverride) && (
            <Text style={[base.muted, { marginTop: 6, fontSize: 7.5 }]}>
              * Entregue com CA vencido, liberada por proprietário ou
              administrador com justificativa registrada na auditoria.
            </Text>
          )}
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
