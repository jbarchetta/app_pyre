import { describe, it, expect, vi } from "vitest";
import { render, screen, within, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SeccionBlock } from "./SeccionBlock";
import type { Seccion } from "../api/client";

const seccion: Seccion = { id: "s1", tablero_id: "t1", nombre: "Sección 1", orden: 0 };

const salidaSinMatch = {
  id: "sal2",
  seccion_id: "s1",
  carga_valor: "10",
  carga_unidad: "A",
  formato: "unipolar" as const,
  tipo_proteccion: "seccional_termomagnetico" as const,
  componente_id: null,
  origen: "manual",
  asignado_manualmente: false,
  posicion_orden: 0,
};

const salidaConMatch = {
  id: "sal3",
  seccion_id: "s1",
  carga_valor: "20",
  carga_unidad: "A",
  formato: "unipolar" as const,
  tipo_proteccion: "seccional_termomagnetico" as const,
  componente_id: "c1",
  componente_codigo: "1SDA067004R1",
  componente_codigo_comercial: "XT2N 160 TMD 160-1600",
  origen: "manual",
  asignado_manualmente: false,
  posicion_orden: 0,
};

describe("SeccionBlock", () => {
  it("creates a salida with an automatic proposal", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          id: "sal1",
          seccion_id: "s1",
          carga_valor: "16",
          carga_unidad: "A",
          formato: "unipolar",
          tipo_proteccion: "seccional_termomagnetico",
          componente_id: "c1",
          origen: "manual",
        }),
      }),
    );
    const onSalidaCreada = vi.fn();
    render(
      <SeccionBlock
        seccion={seccion}
        salidas={[]}
        onSalidaCreada={onSalidaCreada}
        onSalidaActualizada={vi.fn()}
        onSalidaBorrada={vi.fn()}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: /nueva salida/i }));
    await userEvent.selectOptions(screen.getByLabelText(/carga/i), "16");
    await userEvent.click(screen.getByRole("button", { name: /agregar salida/i }));

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("/secciones/s1/salidas"),
      expect.objectContaining({ method: "POST" }),
    );
    expect(onSalidaCreada).toHaveBeenCalledWith(expect.objectContaining({ id: "sal1" }));
  });

  it("shows 'sin match' with no inline picker for a salida without a matched component", () => {
    render(
      <SeccionBlock
        seccion={seccion}
        salidas={[salidaSinMatch]}
        onSalidaCreada={vi.fn()}
        onSalidaActualizada={vi.fn()}
        onSalidaBorrada={vi.fn()}
      />,
    );

    const fila = screen.getByRole("row", { name: /10 a/i });
    expect(fila).toHaveTextContent(/sin match/i);
    expect(screen.queryByLabelText(/buscar código/i)).not.toBeInTheDocument();
  });

  it("shows a filled badge with the matched component id when a salida has a match", () => {
    render(
      <SeccionBlock
        seccion={seccion}
        salidas={[salidaConMatch]}
        onSalidaCreada={vi.fn()}
        onSalidaActualizada={vi.fn()}
        onSalidaBorrada={vi.fn()}
      />,
    );

    const fila = screen.getByRole("row", { name: /20 a/i });
    expect(fila).toHaveTextContent(/1SDA067004R1/i);
    expect(within(fila).getByTitle(/propuesta automática/i)).toBeInTheDocument();
    expect(screen.queryByText(/\bc1\b/)).not.toBeInTheDocument();
  });

  it("opens the edit modal and saves changed carga/formato/protección fields", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ ...salidaConMatch, carga_valor: "30.00" }),
      }),
    );
    const onSalidaActualizada = vi.fn();
    render(
      <SeccionBlock
        seccion={seccion}
        salidas={[salidaConMatch]}
        onSalidaCreada={vi.fn()}
        onSalidaActualizada={onSalidaActualizada}
        onSalidaBorrada={vi.fn()}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: /editar salida 20 a/i }));
    const dialog = screen.getByRole("dialog");
    const select = within(dialog).getByLabelText(/carga/i) as HTMLSelectElement;
    expect(select.value).toBe("20");
    await userEvent.selectOptions(select, "30");
    await userEvent.click(screen.getByRole("button", { name: /^guardar$/i }));

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("/salidas/sal3"),
      expect.objectContaining({ method: "PATCH" }),
    );
    expect(onSalidaActualizada).toHaveBeenCalledWith(expect.objectContaining({ carga_valor: "30.00" }));
  });

  it("closes the edit modal with Escape without saving directly", async () => {
    render(
      <SeccionBlock
        seccion={seccion}
        salidas={[salidaConMatch]}
        onSalidaCreada={vi.fn()}
        onSalidaActualizada={vi.fn()}
        onSalidaBorrada={vi.fn()}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: /editar salida 20 a/i }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    await userEvent.keyboard("{Escape}");

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("ignores a PATCH response that resolves after the edit modal was closed via Escape", async () => {
    let resolvePatch!: (value: { ok: boolean; json: () => Promise<unknown> }) => void;
    const patchPromise = new Promise<{ ok: boolean; json: () => Promise<unknown> }>((resolve) => {
      resolvePatch = resolve;
    });
    vi.stubGlobal("fetch", vi.fn().mockReturnValue(patchPromise));
    const onSalidaActualizada = vi.fn();
    render(
      <SeccionBlock
        seccion={seccion}
        salidas={[salidaConMatch]}
        onSalidaCreada={vi.fn()}
        onSalidaActualizada={onSalidaActualizada}
        onSalidaBorrada={vi.fn()}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: /editar salida 20 a/i }));
    await userEvent.click(screen.getByRole("button", { name: /^guardar$/i }));
    await userEvent.keyboard("{Escape}");

    resolvePatch({ ok: true, json: async () => ({ ...salidaConMatch, carga_valor: "99.00" }) });
    await patchPromise;

    expect(onSalidaActualizada).not.toHaveBeenCalled();
  });

  it("reassigns the component of an already-matched salida from the edit modal", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((url: string, init?: RequestInit) => {
        if (url.includes("/catalogo/buscar")) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              resultados: [{ id: "c9", codigo: "XT2N100", descripcion: "Otro interruptor", precio_neto: "10.00" }],
              total: 1,
            }),
          });
        }
        if (init?.method === "PATCH") {
          return Promise.resolve({ ok: true, json: async () => ({ ...salidaConMatch, componente_id: "c9" }) });
        }
        return Promise.resolve({ ok: true, json: async () => ({}) });
      }),
    );
    const onSalidaActualizada = vi.fn();
    render(
      <SeccionBlock
        seccion={seccion}
        salidas={[salidaConMatch]}
        onSalidaCreada={vi.fn()}
        onSalidaActualizada={onSalidaActualizada}
        onSalidaBorrada={vi.fn()}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: /editar salida 20 a/i }));
    await userEvent.click(screen.getByRole("button", { name: /cambiar componente/i }));
    await userEvent.type(screen.getByLabelText(/buscar código/i), "XT2N100");
    await userEvent.click(await screen.findByRole("button", { name: /XT2N100/i }));
    await userEvent.click(screen.getByRole("button", { name: /^guardar$/i }));

    expect(onSalidaActualizada).toHaveBeenCalledWith(expect.objectContaining({ componente_id: "c9" }));
  });

  it("deletes a salida after confirming", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }));
    const onSalidaBorrada = vi.fn();
    render(
      <SeccionBlock
        seccion={seccion}
        salidas={[salidaConMatch]}
        onSalidaCreada={vi.fn()}
        onSalidaActualizada={vi.fn()}
        onSalidaBorrada={onSalidaBorrada}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: /borrar salida 20 a/i }));
    await userEvent.click(screen.getByRole("button", { name: /^borrar$/i }));

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("/salidas/sal3"),
      expect.objectContaining({ method: "DELETE" }),
    );
    expect(onSalidaBorrada).toHaveBeenCalledWith("sal3");
  });

  it("cancelling the delete confirmation does not delete the salida", async () => {
    vi.stubGlobal("fetch", vi.fn());
    const onSalidaBorrada = vi.fn();
    render(
      <SeccionBlock
        seccion={seccion}
        salidas={[salidaConMatch]}
        onSalidaCreada={vi.fn()}
        onSalidaActualizada={vi.fn()}
        onSalidaBorrada={onSalidaBorrada}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: /borrar salida 20 a/i }));
    await userEvent.click(screen.getByRole("button", { name: /cancelar/i }));

    expect(onSalidaBorrada).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ method: "DELETE" }));
  });

  it("shows an error and keeps the confirmation open if deleting the salida fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));
    render(
      <SeccionBlock
        seccion={seccion}
        salidas={[salidaConMatch]}
        onSalidaCreada={vi.fn()}
        onSalidaActualizada={vi.fn()}
        onSalidaBorrada={vi.fn()}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: /borrar salida 20 a/i }));
    await userEvent.click(screen.getByRole("button", { name: /^borrar$/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/no se pudo borrar la salida/i);
    expect(screen.getByRole("row", { name: /20 a/i })).toBeInTheDocument();
  });

  it("shows the readable codigo (not the raw id) in the edit modal", async () => {
    render(
      <SeccionBlock
        seccion={seccion}
        salidas={[salidaConMatch]}
        onSalidaCreada={vi.fn()}
        onSalidaActualizada={vi.fn()}
        onSalidaBorrada={vi.fn()}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: /editar salida 20 a/i }));

    expect(within(screen.getByRole("dialog")).getByText("1SDA067004R1")).toBeInTheDocument();
  });

  it("does not close the edit modal when a mousedown starts inside it but the click resolves on the backdrop", async () => {
    render(
      <SeccionBlock
        seccion={seccion}
        salidas={[salidaConMatch]}
        onSalidaCreada={vi.fn()}
        onSalidaActualizada={vi.fn()}
        onSalidaBorrada={vi.fn()}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: /editar salida 20 a/i }));
    const dialog = screen.getByRole("dialog");
    const backdrop = dialog.parentElement!;
    fireEvent.mouseDown(dialog);
    fireEvent.click(backdrop);

    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("shows the backend's actual error message when creating a salida fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({ detail: "La carga en amperios debe ser un número entero" }),
      }),
    );
    render(
      <SeccionBlock
        seccion={seccion}
        salidas={[]}
        onSalidaCreada={vi.fn()}
        onSalidaActualizada={vi.fn()}
        onSalidaBorrada={vi.fn()}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: /nueva salida/i }));
    await userEvent.selectOptions(screen.getByLabelText(/carga/i), "16");
    await userEvent.click(screen.getByRole("button", { name: /agregar salida/i }));

    expect(await screen.findByText("La carga en amperios debe ser un número entero")).toBeInTheDocument();
  });

  it("closes the edit modal directly without saving when closing via Cancelar", async () => {
    render(
      <SeccionBlock
        seccion={seccion}
        salidas={[salidaConMatch]}
        onSalidaCreada={vi.fn()}
        onSalidaActualizada={vi.fn()}
        onSalidaBorrada={vi.fn()}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: /editar salida 20 a/i }));
    expect(screen.getByText(/editar salida/i)).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /^cancelar$/i }));
    expect(screen.queryByText(/editar salida/i)).not.toBeInTheDocument();
  });

  it("closes the edit modal directly without saving when pressing Escape", async () => {
    render(
      <SeccionBlock
        seccion={seccion}
        salidas={[salidaConMatch]}
        onSalidaCreada={vi.fn()}
        onSalidaActualizada={vi.fn()}
        onSalidaBorrada={vi.fn()}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: /editar salida 20 a/i }));
    expect(screen.getByText(/editar salida/i)).toBeInTheDocument();

    await userEvent.keyboard("{Escape}");
    expect(screen.queryByText(/editar salida/i)).not.toBeInTheDocument();
  });

  it("wraps the salidas table in a horizontally scrollable container", () => {
    render(
      <SeccionBlock
        seccion={seccion}
        salidas={[salidaConMatch]}
        onSalidaCreada={vi.fn()}
        onSalidaActualizada={vi.fn()}
        onSalidaBorrada={vi.fn()}
      />,
    );

    const tabla = screen.getByRole("table");
    expect(tabla.parentElement).toHaveClass("overflow-x-auto");
  });

  it("restricts Formato dropdown to Bipolar and Tetrapolar when Protección is set to Diferencial", async () => {
    render(
      <SeccionBlock
        seccion={seccion}
        salidas={[salidaSinMatch]}
        onSalidaCreada={vi.fn()}
        onSalidaActualizada={vi.fn()}
        onSalidaBorrada={vi.fn()}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: /editar salida 10 a/i }));

    const proteccionSelect = screen.getByLabelText(/protección/i);
    await userEvent.selectOptions(proteccionSelect, "seccional_diferencial");

    const formatoSelect = screen.getByLabelText(/formato/i);
    expect(within(formatoSelect).queryByText(/unipolar/i)).not.toBeInTheDocument();
    expect(within(formatoSelect).getByText(/bipolar/i)).toBeInTheDocument();
    expect(within(formatoSelect).queryByText(/tripolar/i)).not.toBeInTheDocument();
    expect(within(formatoSelect).getByText(/tetrapolar/i)).toBeInTheDocument();
  });
});
