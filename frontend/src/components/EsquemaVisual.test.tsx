import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { EsquemaVisual } from "./EsquemaVisual";
import type { Salida, Seccion } from "../api/client";

const seccion: Seccion = { id: "s1", tablero_id: "t1", nombre: "Sección 1", orden: 0 };

function salida(overrides: Partial<Salida>): Salida {
  return {
    id: "sal1",
    seccion_id: "s1",
    carga_valor: "10",
    carga_unidad: "A",
    formato: "unipolar",
    tipo_proteccion: "seccional_termomagnetico",
    componente_id: "c1",
    origen: "manual",
    ...overrides,
  };
}

describe("EsquemaVisual", () => {
  it("draws a wider rectangle for more poles", () => {
    render(
      <EsquemaVisual
        tieneInterruptorPrincipal={false}
        secciones={[{ seccion, salidas: [salida({ id: "sal-tetra", formato: "tetrapolar" })] }]}
      />,
    );

    expect(screen.getByTestId("salida-sal-tetra")).toHaveAttribute("width", "96");
  });

  it("uses the color matching tipo_proteccion", () => {
    render(
      <EsquemaVisual
        tieneInterruptorPrincipal={false}
        secciones={[{ seccion, salidas: [salida({ id: "sal-dif", tipo_proteccion: "seccional_diferencial" })] }]}
      />,
    );

    expect(screen.getByTestId("salida-sal-dif")).toHaveAttribute("fill", "#d94a6a");
  });

  it("draws a dashed outline with no fill when there is no matched component", () => {
    render(
      <EsquemaVisual
        tieneInterruptorPrincipal={false}
        secciones={[{ seccion, salidas: [salida({ id: "sal-sinmatch", componente_id: null })] }]}
      />,
    );

    const rect = screen.getByTestId("salida-sal-sinmatch");
    expect(rect).toHaveAttribute("fill", "none");
    expect(rect).toHaveAttribute("stroke-dasharray", "2,2");
  });

  it("renders the interruptor principal block only when present", () => {
    const { rerender } = render(<EsquemaVisual tieneInterruptorPrincipal={false} secciones={[]} />);
    expect(screen.queryByTestId("interruptor-principal")).not.toBeInTheDocument();

    rerender(<EsquemaVisual tieneInterruptorPrincipal={true} secciones={[]} />);
    expect(screen.getByTestId("interruptor-principal")).toBeInTheDocument();
  });
});
