import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SeccionBlock } from "./SeccionBlock";
import type { Seccion } from "../api/client";

const seccion: Seccion = { id: "s1", tablero_id: "t1", nombre: "Sección 1", orden: 0 };

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
      <SeccionBlock seccion={seccion} salidas={[]} onSalidaCreada={onSalidaCreada} onSalidaActualizada={vi.fn()} />,
    );

    await userEvent.type(screen.getByLabelText(/carga/i), "16");
    await userEvent.click(screen.getByRole("button", { name: /agregar salida/i }));

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("/secciones/s1/salidas"),
      expect.objectContaining({ method: "POST" }),
    );
    expect(onSalidaCreada).toHaveBeenCalledWith(expect.objectContaining({ id: "sal1" }));
  });

  it("shows a picker to override manually when a salida has no matched component", () => {
    render(
      <SeccionBlock
        seccion={seccion}
        salidas={[
          {
            id: "sal2",
            seccion_id: "s1",
            carga_valor: "10",
            carga_unidad: "A",
            formato: "unipolar",
            tipo_proteccion: "seccional_termomagnetico",
            componente_id: null,
            origen: "manual",
          },
        ]}
        onSalidaCreada={vi.fn()}
        onSalidaActualizada={vi.fn()}
      />,
    );

    expect(screen.getByText(/sin match/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/buscar código/i)).toBeInTheDocument();
  });
});
