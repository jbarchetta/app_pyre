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

  it("generates 1:1 Nollmann NIS parametric cabinet geometry for 'topografico' view", () => {
    const doc = generateBoardCadDocument({
      tieneInterruptorPrincipal: true,
      interruptorPrincipal: { corriente_nominal_a: 63, polos: 3, codigo: "Q1-MAIN" },
      secciones: dummySecciones,
      modoVisual: "topografico",
      gabineteAnchoMm: 450,
      gabineteAltoMm: 600,
    });

    expect(doc.title).toContain("Topográfica");

    // Verify 6 concentric frames
    const gabMarcos = doc.primitives.filter((p) => p.id?.startsWith("gab-marco-"));
    expect(gabMarcos.length).toBe(6);

    // Frame 0: Filo exterior gabinete (off = 0.00mm, W = 450mm, H = 600mm)
    const m0 = gabMarcos[0] as any;
    expect(m0.x).toBe(60);
    expect(m0.width).toBe(450.00);
    expect(m0.height).toBe(600.00);
    expect(m0.rx).toBe(3.20);

    // Frame 2: Pestaña exterior (off = 19.00mm, W = 450 - 38 = 412mm, H = 600 - 38 = 562mm)
    const m2 = gabMarcos[2] as any;
    expect(m2.x).toBe(60 + 19.00);
    expect(m2.width).toBe(412.00);
    expect(m2.height).toBe(562.00);
    expect(m2.rx).toBe(3.20);

    // Frame 5: Bandeja interior (off = 27.50mm, W = 450 - 55 = 395mm, H = 600 - 55 = 545mm)
    const m5 = gabMarcos[5] as any;
    expect(m5.x).toBe(60 + 27.50);
    expect(m5.width).toBe(395.00);
    expect(m5.height).toBe(545.00);
    expect(m5.rx).toBe(1.60);

    // Verify top and bottom 3mm covers
    const tapaSup = doc.primitives.find((p) => p.id === "gab-tapa-sup-e0");
    expect(tapaSup).toBeDefined();

    const tapaInf = doc.primitives.find((p) => p.id === "gab-tapa-inf-e0");
    expect(tapaInf).toBeDefined();
  });
});

