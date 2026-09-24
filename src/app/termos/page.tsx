import type { Metadata } from "next";
import { LegalPage } from "@/components/shared/legal-page";

export const metadata: Metadata = { title: "Termos de Uso — Almox SST" };

export default function TermsPage() {
  return (
    <LegalPage title="Termos de Uso" updatedAt="23/09/2026">
      <p>
        Estes termos regem o uso do Almox SST, software de gestão de EPIs,
        estoque de materiais de segurança e treinamentos, oferecido como serviço
        (SaaS) a empresas.
      </p>
      <h2>1. Quem usa</h2>
      <p>
        A conta é da empresa cliente (organização). Cada usuário é convidado
        pela organização e responde pelo sigilo da própria senha. A organização
        define os papéis de acesso de cada pessoa.
      </p>
      <h2>2. Papel do Almox SST nos dados</h2>
      <p>
        A empresa cliente é a <strong>controladora</strong> dos dados dos seus
        funcionários. O Almox SST atua como <strong>operador</strong>, tratando
        os dados apenas para prestar o serviço e conforme as instruções da
        empresa, nos termos da Lei nº 13.709/2018 (LGPD) e do contrato de
        tratamento de dados (DPA).
      </p>
      <h2>3. Responsabilidades da empresa</h2>
      <ul>
        <li>
          Manter os cadastros corretos e atualizados (funcionários, EPIs, CA,
          prazos de treinamento).
        </li>
        <li>
          Validar com seu responsável técnico os prazos de reciclagem e o termo
          de responsabilidade.
        </li>
        <li>Informar seus funcionários sobre o tratamento dos dados.</li>
      </ul>
      <h2>4. O que o sistema não faz</h2>
      <p>
        O Almox SST organiza registros e alertas. Ele não substitui o
        responsável técnico de segurança do trabalho nem garante, por si só, o
        cumprimento das Normas Regulamentadoras.
      </p>
      <h2>5. Disponibilidade e dados</h2>
      <p>
        Os dados ficam em servidores no Brasil (São Paulo), com backups do
        provedor. Ao encerrar a conta, a empresa pode exportar seus dados por 30
        dias; depois disso, eles são excluídos, salvo obrigação legal de guarda.
      </p>
      <h2>6. Contato</h2>
      <p>Dúvidas sobre estes termos: contato a definir.</p>
    </LegalPage>
  );
}
