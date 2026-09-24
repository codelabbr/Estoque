import type { Metadata } from "next";
import { LegalPage } from "@/components/shared/legal-page";

export const metadata: Metadata = {
  title: "Política de Privacidade — Almox SST",
};

export default function PrivacyPage() {
  return (
    <LegalPage title="Política de Privacidade" updatedAt="23/09/2026">
      <p>
        Esta política explica como os dados pessoais são tratados no Almox SST,
        em conformidade com a LGPD (Lei nº 13.709/2018).
      </p>
      <h2>1. Controlador e operador</h2>
      <p>
        Os dados dos funcionários são tratados pela empresa empregadora (
        <strong>controladora</strong>) para cumprir obrigações legais de
        segurança e saúde no trabalho, como o registro de entrega de EPI (NR-6)
        e de treinamentos. O Almox SST é o <strong>operador</strong> desses
        dados.
      </p>
      <h2>2. Dados tratados</h2>
      <ul>
        <li>
          Funcionários: nome, CPF, matrícula, cargo, setor, datas de admissão e
          desligamento, telefone e e-mail (opcionais).
        </li>
        <li>
          Entregas de EPI: itens, datas, assinatura (imagem ou nome digitado),
          endereço IP e navegador usados na assinatura.
        </li>
        <li>Treinamentos: tipo, datas, entidade, instrutor e certificado.</li>
        <li>
          Usuários do sistema: e-mail e registro das ações realizadas
          (auditoria).
        </li>
      </ul>
      <p>
        Não coletamos endereço, RG, dados de saúde nem outros dados sensíveis.
      </p>
      <h2>3. Base legal</h2>
      <p>
        Cumprimento de obrigação legal ou regulatória pelo empregador (art. 7º,
        II, da LGPD). A assinatura do funcionário confirma o recebimento do EPI
        e não depende de consentimento para o tratamento dos dados.
      </p>
      <h2>4. Segurança</h2>
      <ul>
        <li>
          Dados armazenados no Brasil, com acesso restrito por empresa e por
          papel do usuário.
        </li>
        <li>CPF mascarado em listas e na página pública de assinatura.</li>
        <li>Links de assinatura de uso único, com validade de 72 horas.</li>
        <li>
          Registros de entrega e assinatura imutáveis, com código de
          integridade.
        </li>
      </ul>
      <h2>5. Retenção</h2>
      <p>
        Os registros são mantidos pelo prazo exigido pela legislação trabalhista
        e previdenciária aplicável (prazo a confirmar com a assessoria
        jurídica). Após o desligamento, o cadastro pode ser anonimizado pela
        empresa.
      </p>
      <h2>6. Direitos do titular</h2>
      <p>
        O funcionário pode solicitar à empresa acesso, correção ou informações
        sobre seus dados. A empresa exporta os dados pelo próprio sistema para
        atender o pedido.
      </p>
      <h2>7. Contato do encarregado</h2>
      <p>Encarregado (DPO): contato a definir.</p>
    </LegalPage>
  );
}
