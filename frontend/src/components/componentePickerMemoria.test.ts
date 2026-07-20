import { describe, it, expect, beforeEach } from "vitest";
import { obtenerMemoria, guardarMemoria, limpiarMemoriaParaTests } from "./componentePickerMemoria";

describe("componentePickerMemoria", () => {
  beforeEach(() => {
    limpiarMemoriaParaTests();
  });

  it("returns undefined for a context that was never saved", () => {
    expect(obtenerMemoria("nunca-usado")).toBeUndefined();
  });

  it("returns exactly what was saved for a given context", () => {
    guardarMemoria("interruptor-principal", {
      query: "XT2N",
      filtroPolos: 3,
      filtroCorriente: "16",
      filtroCapacidad: null,
    });

    expect(obtenerMemoria("interruptor-principal")).toEqual({
      query: "XT2N",
      filtroPolos: 3,
      filtroCorriente: "16",
      filtroCapacidad: null,
    });
  });

  it("keeps different contexts independent", () => {
    guardarMemoria("interruptor-principal", { query: "XT2N", filtroPolos: null, filtroCorriente: null, filtroCapacidad: null });
    guardarMemoria("salida-componente", { query: "S200", filtroPolos: null, filtroCorriente: null, filtroCapacidad: null });

    expect(obtenerMemoria("interruptor-principal")?.query).toBe("XT2N");
    expect(obtenerMemoria("salida-componente")?.query).toBe("S200");
  });

  it("overwrites the previous value for the same context", () => {
    guardarMemoria("salida-componente", { query: "primero", filtroPolos: null, filtroCorriente: null, filtroCapacidad: null });
    guardarMemoria("salida-componente", { query: "segundo", filtroPolos: null, filtroCorriente: null, filtroCapacidad: null });

    expect(obtenerMemoria("salida-componente")?.query).toBe("segundo");
  });
});
