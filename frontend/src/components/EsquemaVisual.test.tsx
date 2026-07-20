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
    asignado_manualmente: false,
    posicion_orden: 0,
    ...overrides,
  };
}

describe("EsquemaVisual", () => {
  it("renders breaker card with fixed width and height", () => {
    render(
      <EsquemaVisual
        tieneInterruptorPrincipal={false}
        secciones={[{ seccion, salidas: [salida({ id: "sal-1" })] }]}
      />,
    );

    const rect = screen.getByTestId("salida-sal-1");
    expect(rect).toHaveAttribute("width", "114");
    expect(rect).toHaveAttribute("height", "48");
  });

  it("renders system auto-code F1.1 in top-left of card", () => {
    render(
      <EsquemaVisual
        tieneInterruptorPrincipal={false}
        secciones={[{ seccion, salidas: [salida({ id: "sal-auto" })] }]}
      />,
    );

    expect(screen.getByText("F1.1")).toBeInTheDocument();
  });

  it("fills a white card for an assigned salida", () => {
    render(
      <EsquemaVisual
        tieneInterruptorPrincipal={false}
        secciones={[{ seccion, salidas: [salida({ id: "sal-term" })] }]}
      />,
    );

    expect(screen.getByTestId("salida-sal-term")).toHaveAttribute("fill", "#ffffff");
  });

  it("draws a warning outline with amber background when there is no matched component", () => {
    render(
      <EsquemaVisual
        tieneInterruptorPrincipal={false}
        secciones={[{ seccion, salidas: [salida({ id: "sal-sinmatch", componente_id: null })] }]}
      />,
    );

    const rect = screen.getByTestId("salida-sal-sinmatch");
    expect(rect).toHaveAttribute("fill", "#fffbe6");
    expect(rect).toHaveAttribute("stroke-dasharray", "3,2");
  });

  it("renders the interruptor principal block only when present", () => {
    const { rerender } = render(<EsquemaVisual tieneInterruptorPrincipal={false} secciones={[]} />);
    expect(screen.queryByTestId("interruptor-principal")).not.toBeInTheDocument();

    rerender(<EsquemaVisual tieneInterruptorPrincipal={true} secciones={[]} />);
    expect(screen.getByTestId("interruptor-principal")).toBeInTheDocument();
  });

  it("shows the rating pill badge when the codigos layer is on and hides it when off", () => {
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

  it("shows the embarrado line when the embarrado layer is on and hides it when off", () => {
    const { rerender } = render(
      <EsquemaVisual tieneInterruptorPrincipal={false} secciones={[]} capas={{ codigos: true, embarrado: true }} />,
    );
    expect(screen.getByTestId("embarrado")).toBeInTheDocument();

    rerender(
      <EsquemaVisual tieneInterruptorPrincipal={false} secciones={[]} capas={{ codigos: true, embarrado: false }} />,
    );
    expect(screen.queryByTestId("embarrado")).not.toBeInTheDocument();
  });

  it("scales the rendered width up when zoomed in, without clipping the viewBox", () => {
    render(<EsquemaVisual tieneInterruptorPrincipal={false} secciones={[]} zoom={2} />);

    const svg = screen.getByRole("img", { name: /esquema visual del tablero/i });
    expect(svg).toHaveAttribute("width", "1040");
    const [, , viewBoxAncho] = svg.getAttribute("viewBox")!.split(" ").map(Number);
    expect(viewBoxAncho).toBe(520);
  });
});
