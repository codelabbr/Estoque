import { describe, expect, it } from "vitest";
import { employeeSchema } from "../schemas";
import { maskCpfPartial } from "@/lib/validators";

const base = { fullName: "Ana Souza", cpf: "529.982.247-25" };

describe("employeeSchema", () => {
  it("normaliza CPF, telefone e e-mail", () => {
    const r = employeeSchema.parse({
      ...base,
      phone: "(11) 98765-4321",
      email: "ANA@Empresa.com",
    });
    expect(r.cpf).toBe("52998224725");
    expect(r.phone).toBe("11987654321");
    expect(r.email).toBe("ana@empresa.com");
  });

  it("exige nome e sobrenome e CPF válido", () => {
    expect(employeeSchema.safeParse({ ...base, fullName: "Ana" }).success).toBe(
      false,
    );
    expect(
      employeeSchema.safeParse({ ...base, cpf: "111.111.111-11" }).success,
    ).toBe(false);
  });

  it("campos opcionais vazios viram null", () => {
    const r = employeeSchema.parse({
      ...base,
      registration: "",
      jobRoleId: "",
      hiredAt: "",
    });
    expect(r.registration).toBeNull();
    expect(r.jobRoleId).toBeNull();
    expect(r.hiredAt).toBeNull();
  });
});

describe("maskCpfPartial", () => {
  it("mostra só os dígitos do meio", () => {
    expect(maskCpfPartial("52998224725")).toBe("***.982.247-**");
  });
});
