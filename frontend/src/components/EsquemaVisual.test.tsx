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

  it("draws a tripolar rectangle three poles wide", () => {
    render(
      <EsquemaVisual
        tieneInterruptorPrincipal={false}
        secciones={[{ seccion, salidas: [salida({ id: "sal-tri", formato: "tripolar" })] }]}
      />,
    );

    expect(screen.getByTestId("salida-sal-tri")).toHaveAttribute("width", "72");
  });

  it("fills a termomagnetico salida solid", () => {
    render(
      <EsquemaVisual
        tieneInterruptorPrincipal={false}
        secciones={[{ seccion, salidas: [salida({ id: "sal-term" })] }]}
      />,
    );

    expect(screen.getByTestId("salida-sal-term")).toHaveAttribute("fill", "#1a1c1c");
  });

  it("fills a diferencial salida with the diagonal-stripe pattern", () => {
    render(
      <EsquemaVisual
        tieneInterruptorPrincipal={false}
        secciones={[{ seccion, salidas: [salida({ id: "sal-dif", tipo_proteccion: "seccional_diferencial" })] }]}
      />,
    );

    expect(screen.getByTestId("salida-sal-dif")).toHaveAttribute("fill", "url(#rayas-diferencial)");
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

  it("renders the interruptor principal block only when present, in the accent color", () => {
    const { rerender } = render(<EsquemaVisual tieneInterruptorPrincipal={false} secciones={[]} />);
    expect(screen.queryByTestId("interruptor-principal")).not.toBeInTheDocument();

    rerender(<EsquemaVisual tieneInterruptorPrincipal={true} secciones={[]} />);
    expect(screen.getByTestId("interruptor-principal")).toHaveAttribute("fill", "#e31f26");
  });

  it("shows the componente code label when the codigos layer is on and hides it when off", () => {
    const { rerender } = render(
      <EsquemaVisual
        tieneInterruptorPrincipal={false}
        secciones={[{ seccion, salidas: [salida({ id: "sal-label" })] }]}
        capas={{ codigos: true, embarrado: true }}
      />,
    );
    expect(screen.getByTestId("salida-sal-label-codigo")).toBeInTheDocument();

    rerender(
      <EsquemaVisual
        tieneInterruptorPrincipal={false}
        secciones={[{ seccion, salidas: [salida({ id: "sal-label" })] }]}
        capas={{ codigos: false, embarrado: true }}
      />,
    );
    expect(screen.queryByTestId("salida-sal-label-codigo")).not.toBeInTheDocument();
  });

  it("shows the embarrado band when the embarrado layer is on and hides it when off", () => {
    const { rerender } = render(
      <EsquemaVisual tieneInterruptorPrincipal={false} secciones={[]} capas={{ codigos: true, embarrado: true }} />,
    );
    expect(screen.getByTestId("embarrado")).toBeInTheDocument();

    rerender(
      <EsquemaVisual tieneInterruptorPrincipal={false} secciones={[]} capas={{ codigos: true, embarrado: false }} />,
    );
    expect(screen.queryByTestId("embarrado")).not.toBeInTheDocument();
  });

  it("scales the viewBox down when zoomed in, so content renders larger", () => {
    render(<EsquemaVisual tieneInterruptorPrincipal={false} secciones={[]} zoom={2} />);

    const svg = screen.getByRole("img", { name: /esquema visual del tablero/i });
    const [, , viewBoxAncho] = svg.getAttribute("viewBox")!.split(" ").map(Number);
    expect(viewBoxAncho).toBe(240);
  });
});
