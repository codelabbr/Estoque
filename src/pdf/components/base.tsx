import { StyleSheet, Text, View } from "@react-pdf/renderer";

export const colors = {
  text: "#0f1419",
  muted: "#536471",
  border: "#cfd9de",
  soft: "#f7f9f9",
};

export const base = StyleSheet.create({
  page: {
    paddingTop: 36,
    paddingBottom: 54,
    paddingHorizontal: 36,
    fontSize: 9,
    fontFamily: "Helvetica",
    color: colors.text,
  },
  h1: { fontSize: 14, fontFamily: "Helvetica-Bold" },
  h2: { fontSize: 10, fontFamily: "Helvetica-Bold", marginBottom: 4 },
  muted: { color: colors.muted },
  section: { marginTop: 12 },
  box: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 4,
    padding: 8,
  },
  row: { flexDirection: "row" },
  th: {
    fontFamily: "Helvetica-Bold",
    fontSize: 8,
    color: colors.muted,
    paddingVertical: 4,
    paddingHorizontal: 3,
  },
  td: { fontSize: 8.5, paddingVertical: 4, paddingHorizontal: 3 },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: colors.soft,
    borderBottomWidth: 1,
    borderColor: colors.border,
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderColor: colors.border,
    alignItems: "center",
  },
});

export function DocHeader({
  orgName,
  legalName,
  cnpj,
  title,
  subtitle,
}: {
  orgName: string;
  legalName: string | null;
  cnpj: string | null;
  title: string;
  subtitle?: string;
}) {
  const cnpjFmt = cnpj?.replace(
    /^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/,
    "$1.$2.$3/$4-$5",
  );
  return (
    <View
      style={[
        base.row,
        {
          justifyContent: "space-between",
          borderBottomWidth: 1.5,
          borderColor: colors.text,
          paddingBottom: 8,
        },
      ]}
    >
      <View>
        <Text style={base.h1}>{title}</Text>
        {subtitle && (
          <Text style={[base.muted, { marginTop: 2 }]}>{subtitle}</Text>
        )}
      </View>
      <View style={{ alignItems: "flex-end", maxWidth: 260 }}>
        <Text style={{ fontFamily: "Helvetica-Bold" }}>
          {legalName || orgName}
        </Text>
        {legalName && legalName !== orgName && (
          <Text style={base.muted}>{orgName}</Text>
        )}
        {cnpjFmt && <Text style={base.muted}>CNPJ {cnpjFmt}</Text>}
      </View>
    </View>
  );
}

export function DocFooter({
  emittedAt,
  emittedBy,
  code,
}: {
  emittedAt: string;
  emittedBy: string;
  code: string;
}) {
  return (
    <View
      fixed
      style={{
        position: "absolute",
        bottom: 24,
        left: 36,
        right: 36,
        flexDirection: "row",
        justifyContent: "space-between",
        fontSize: 7.5,
        color: colors.muted,
      }}
    >
      <Text>
        Emitido em {emittedAt} por {emittedBy} · Almox SST
      </Text>
      <Text
        render={({ pageNumber, totalPages }) =>
          `Código de verificação ${code} · Página ${pageNumber} de ${totalPages}`
        }
      />
    </View>
  );
}
