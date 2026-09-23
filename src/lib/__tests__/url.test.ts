import { describe, expect, it } from "vitest";
import { safeNextPath } from "@/lib/url";

describe("safeNextPath", () => {
  it("aceita caminhos internos", () => {
    expect(safeNextPath("/onboarding")).toBe("/onboarding");
    expect(safeNextPath("/acme/dashboard?aba=1")).toBe("/acme/dashboard?aba=1");
  });

  it("usa o fallback quando não há destino", () => {
    expect(safeNextPath(null)).toBe("/");
    expect(safeNextPath(undefined)).toBe("/");
    expect(safeNextPath("", "/login")).toBe("/login");
  });

  it("bloqueia destinos externos", () => {
    expect(safeNextPath("https://site-malicioso.com")).toBe("/");
    expect(safeNextPath("//site-malicioso.com")).toBe("/");
    expect(safeNextPath("/\\site-malicioso.com")).toBe("/");
    expect(safeNextPath("javascript:alert(1)")).toBe("/");
    expect(safeNextPath("/\t/site-malicioso.com")).toBe("/");
  });
});
