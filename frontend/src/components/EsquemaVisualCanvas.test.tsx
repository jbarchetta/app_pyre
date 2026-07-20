import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { EsquemaVisualCanvas } from "./EsquemaVisualCanvas";

describe("EsquemaVisualCanvas", () => {
  it("calls onZoomChange with an increased value when clicking zoom in", async () => {
    const onZoomChange = vi.fn();
    render(
      <EsquemaVisualCanvas
        tieneInterruptorPrincipal={false}
        secciones={[]}
        zoom={1}
        onZoomChange={onZoomChange}
        capas={{ codigos: true, embarrado: true }}
        onCapasChange={vi.fn()}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: /acercar/i }));

    expect(onZoomChange).toHaveBeenCalledWith(1.25);
  });

  it("does not go below the 0.5 minimum when zooming out", async () => {
    const onZoomChange = vi.fn();
    render(
      <EsquemaVisualCanvas
        tieneInterruptorPrincipal={false}
        secciones={[]}
        zoom={0.5}
        onZoomChange={onZoomChange}
        capas={{ codigos: true, embarrado: true }}
        onCapasChange={vi.fn()}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: /alejar/i }));

    expect(onZoomChange).toHaveBeenCalledWith(0.5);
  });

  it("does not go above the 2.5 maximum when zooming in", async () => {
    const onZoomChange = vi.fn();
    render(
      <EsquemaVisualCanvas
        tieneInterruptorPrincipal={false}
        secciones={[]}
        zoom={2.5}
        onZoomChange={onZoomChange}
        capas={{ codigos: true, embarrado: true }}
        onCapasChange={vi.fn()}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: /acercar/i }));

    expect(onZoomChange).toHaveBeenCalledWith(2.5);
  });

  it("resets zoom to 100% when clicking the zoom label", async () => {
    const onZoomChange = vi.fn();
    render(
      <EsquemaVisualCanvas
        tieneInterruptorPrincipal={false}
        secciones={[]}
        zoom={1.5}
        onZoomChange={onZoomChange}
        capas={{ codigos: true, embarrado: true }}
        onCapasChange={vi.fn()}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: /ajustar zoom/i }));

    expect(onZoomChange).toHaveBeenCalledWith(1);
  });

  it("opens the layers panel and toggles a layer", async () => {
    const onCapasChange = vi.fn();
    render(
      <EsquemaVisualCanvas
        tieneInterruptorPrincipal={false}
        secciones={[]}
        zoom={1}
        onZoomChange={vi.fn()}
        capas={{ codigos: true, embarrado: true }}
        onCapasChange={onCapasChange}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: /^capas$/i }));
    await userEvent.click(screen.getByLabelText(/embarrado/i));

    expect(onCapasChange).toHaveBeenCalledWith({ codigos: true, embarrado: false });
  });

  it("opens full-screen modal when clicking fullscreen button", async () => {
    render(
      <EsquemaVisualCanvas
        tieneInterruptorPrincipal={false}
        secciones={[]}
        zoom={1}
        onZoomChange={vi.fn()}
        capas={{ codigos: true, embarrado: true }}
        onCapasChange={vi.fn()}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: /pantalla completa/i }));

    expect(screen.getByText("Blueprint Unifilar (Pantalla Completa)")).toBeInTheDocument();
  });
});
