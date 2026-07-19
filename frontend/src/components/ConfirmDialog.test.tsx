import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ConfirmDialog } from "./ConfirmDialog";

describe("ConfirmDialog", () => {
  it("calls onConfirm when Borrar is clicked", async () => {
    const onConfirm = vi.fn();
    render(
      <ConfirmDialog
        titulo="Confirmar borrado"
        mensaje="¿Borrar el tablero 'TG1'?"
        onConfirm={onConfirm}
        onCancel={vi.fn()}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: /^borrar$/i }));

    expect(onConfirm).toHaveBeenCalled();
  });

  it("calls onCancel when Cancelar is clicked, without calling onConfirm", async () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    render(
      <ConfirmDialog titulo="Confirmar borrado" mensaje="¿Borrar?" onConfirm={onConfirm} onCancel={onCancel} />,
    );

    await userEvent.click(screen.getByRole("button", { name: /cancelar/i }));

    expect(onCancel).toHaveBeenCalled();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("calls onCancel on Escape", async () => {
    const onCancel = vi.fn();
    render(<ConfirmDialog titulo="Confirmar borrado" mensaje="¿Borrar?" onConfirm={vi.fn()} onCancel={onCancel} />);

    await userEvent.keyboard("{Escape}");

    expect(onCancel).toHaveBeenCalled();
  });

  it("calls onCancel when clicking the backdrop", async () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    render(
      <ConfirmDialog titulo="Confirmar borrado" mensaje="¿Borrar?" onConfirm={onConfirm} onCancel={onCancel} />,
    );

    const dialog = screen.getByRole("dialog");
    await userEvent.click(dialog.parentElement!);

    expect(onCancel).toHaveBeenCalled();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("shows the message so the user knows what's being deleted", () => {
    render(
      <ConfirmDialog
        titulo="Confirmar borrado"
        mensaje="Esto va a borrar el tablero 'TG1' y sus 2 filas con 5 elementos."
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    expect(screen.getByText(/2 filas con 5 elementos/i)).toBeInTheDocument();
  });

  it("disables the Borrar button while confirmando is true", () => {
    render(
      <ConfirmDialog
        titulo="Confirmar borrado"
        mensaje="¿Borrar?"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
        confirmando
      />,
    );

    expect(screen.getByRole("button", { name: /^borrar$/i })).toBeDisabled();
  });

  it("shows an error message when the error prop is set", () => {
    render(
      <ConfirmDialog
        titulo="Confirmar borrado"
        mensaje="¿Borrar?"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
        error="No se pudo borrar el proyecto"
      />,
    );

    expect(screen.getByRole("alert")).toHaveTextContent(/no se pudo borrar el proyecto/i);
  });

  it("does not close when a mousedown starts inside the dialog but the click resolves on the backdrop", () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    render(
      <ConfirmDialog titulo="Confirmar borrado" mensaje="¿Borrar?" onConfirm={onConfirm} onCancel={onCancel} />,
    );

    const dialog = screen.getByRole("dialog");
    const backdrop = dialog.parentElement!;
    fireEvent.mouseDown(dialog);
    fireEvent.click(backdrop);

    expect(onCancel).not.toHaveBeenCalled();
  });
});
