import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { ModalLimiteFilaOpciones } from "./ModalLimiteFilaOpciones";

describe("ModalLimiteFilaOpciones", () => {
  it("renders correctly with 3 path options when a free row exists", () => {
    const onMoverAFila = vi.fn();
    const onConfigurarNuevoTablero = vi.fn();
    const onCancelar = vi.fn();

    render(
      <ModalLimiteFilaOpciones
        isOpen={true}
        filaOrigenNombre="Fila 1"
        polosSolicitados={2}
        polosDisponiblesOrigen={1}
        filaDisponible={{ id: "sec-2", nombre: "Fila 2" }}
        onMoverAFila={onMoverAFila}
        onConfigurarNuevoTablero={onConfigurarNuevoTablero}
        onCancelar={onCancelar}
      />
    );

    expect(screen.getByText("Límite de Fila Alcanzado")).toBeInTheDocument();
    expect(screen.getByText("1. Reubicar en Fila 2")).toBeInTheDocument();
    expect(screen.getByText("2. Configurar Tablero / Gabinete")).toBeInTheDocument();
    expect(screen.getByText("3. Cancelar (No agregar)")).toBeInTheDocument();

    fireEvent.click(screen.getByText("1. Reubicar en Fila 2"));
    expect(onMoverAFila).toHaveBeenCalledWith("sec-2");

    fireEvent.click(screen.getByText("2. Configurar Tablero / Gabinete"));
    expect(onConfigurarNuevoTablero).toHaveBeenCalled();

    fireEvent.click(screen.getByText("3. Cancelar (No agregar)"));
    expect(onCancelar).toHaveBeenCalled();
  });

  it("does not render when isOpen is false", () => {
    const { container } = render(
      <ModalLimiteFilaOpciones
        isOpen={false}
        filaOrigenNombre="Fila 1"
        polosSolicitados={4}
        polosDisponiblesOrigen={0}
        filaDisponible={null}
        onMoverAFila={() => {}}
        onConfigurarNuevoTablero={() => {}}
        onCancelar={() => {}}
      />
    );

    expect(container.firstChild).toBeNull();
  });
});
