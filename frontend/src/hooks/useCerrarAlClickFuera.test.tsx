import { describe, it, expect, vi } from "vitest";
import { render, fireEvent, screen } from "@testing-library/react";
import { useCerrarAlClickFuera } from "./useCerrarAlClickFuera";

function Harness({ onClose }: { onClose: () => void }) {
  const handlers = useCerrarAlClickFuera(onClose);
  return (
    <div data-testid="fondo" {...handlers}>
      <div data-testid="contenido">
        <input data-testid="campo" />
      </div>
    </div>
  );
}

describe("useCerrarAlClickFuera", () => {
  it("closes when mousedown and click both land directly on the backdrop", () => {
    const onClose = vi.fn();
    render(<Harness onClose={onClose} />);
    const fondo = screen.getByTestId("fondo");

    fireEvent.mouseDown(fondo);
    fireEvent.click(fondo);

    expect(onClose).toHaveBeenCalled();
  });

  it("does not close when mousedown starts on a child but the click resolves on the backdrop (the reported bug: selecting text that ends outside the modal)", () => {
    const onClose = vi.fn();
    render(<Harness onClose={onClose} />);
    const fondo = screen.getByTestId("fondo");
    const campo = screen.getByTestId("campo");

    fireEvent.mouseDown(campo);
    fireEvent.click(fondo);

    expect(onClose).not.toHaveBeenCalled();
  });

  it("does not close when both mousedown and click land on a child", () => {
    const onClose = vi.fn();
    render(<Harness onClose={onClose} />);
    const campo = screen.getByTestId("campo");

    fireEvent.mouseDown(campo);
    fireEvent.click(campo);

    expect(onClose).not.toHaveBeenCalled();
  });

  it("resets after a completed backdrop click, so a later child-originated click still does not close", () => {
    const onClose = vi.fn();
    render(<Harness onClose={onClose} />);
    const fondo = screen.getByTestId("fondo");
    const campo = screen.getByTestId("campo");

    fireEvent.mouseDown(fondo);
    fireEvent.click(fondo);
    onClose.mockClear();

    fireEvent.mouseDown(campo);
    fireEvent.click(campo);

    expect(onClose).not.toHaveBeenCalled();
  });
});
