import { describe, it, expect } from "vitest";
import { generateBoardCadDocument } from "./boardCadGenerator";
import type { Salida, Seccion } from "../../api/client";

describe("boardCadGenerator module", () => {
  const dummySecciones: { seccion: Seccion; salidas: Salida[] }[] = [
    {
      seccion: { id: "sec1", tablero_id: "tab1", orden: 1, nombre: "Iluminación" } as Seccion,
      salidas: [
        {
          id: "sal1",
          seccion_id: "sec1",
          posicion_orden: 1,
          etiqueta: "C1",
          carga_valor: "10",
          carga_unidad: "A",
          formato: "unipolar",
          tipo_proteccion: "seccional_termomagnetico",
          componente_id: "comp1",
          origen: "manual",
          asignado_manualmente: true,
          componente_codigo: "1SDA066000R1",
        } as Salida,
        {
          id: "sal2",
          seccion_id: "sec1",
          posicion_orden: 2,
          etiqueta: "C2",
          carga_valor: "16",
          carga_unidad: "A",
          formato: "bipolar",
          tipo_proteccion: "seccional_diferencial",
          componente_id: "comp2",
          origen: "manual",
          asignado_manualmente: true,
          componente_codigo: "1SDA066001R1",
        } as Salida,
      ],
    },
  ];

  it("generates a CAD document for 'bloques' view", () => {
    const doc = generateBoardCadDocument({
      tieneInterruptorPrincipal: true,
      interruptorPrincipal: { corriente_nominal_a: 63, polos: 3, codigo: "Q1-MAIN" },
      secciones: dummySecciones,
      modoVisual: "bloques",
      gabineteAnchoMm: 600,
      gabineteAltoMm: 800,
    });

    expect(doc.layers.length).toBeGreaterThan(5);
    expect(doc.primitives.length).toBeGreaterThan(5);
    const mainBreaker = doc.primitives.find((p) => p.dataId === "main-breaker");
    expect(mainBreaker).toBeDefined();

    const salida1 = doc.primitives.find((p) => p.dataId === "sal1");
    expect(salida1).toBeDefined();

    const salida2 = doc.primitives.find((p) => p.dataId === "sal2");
    expect(salida2).toBeDefined();
  });

  it("generates a CAD document for 'unifilar' view", () => {
    const doc = generateBoardCadDocument({
      tieneInterruptorPrincipal: true,
      interruptorPrincipal: { corriente_nominal_a: 63, polos: 3, codigo: "Q1-MAIN" },
      secciones: dummySecciones,
      modoVisual: "unifilar",
    });

    expect(doc.title).toContain("Unifilar");
    const unifilarPrimitives = doc.primitives.filter((p) => p.layerId === "4_Unifilar");
    expect(unifilarPrimitives.length).toBeGreaterThan(3);
  });
});
