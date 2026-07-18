import { useState } from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DetalleTablero } from "./DetalleTablero";
import type { Tablero } from "../api/client";

const tablero: Tablero = {
  id: "t1",
  proyecto_id: "p1",
  nombre: "TG1",
  nivel_falla_ka: "10.00",
  interruptor_principal_id: "c1",
};

function renderDetalle() {
  render(
    <DetalleTablero
      tablero={tablero}
      onTableroActualizado={vi.fn()}
      vista={{ zoom: 1, capas: { codigos: true, embarrado: true } }}
      onZoomChange={vi.fn()}
      onCapasChange={vi.fn()}
    />,
  );
}

describe("DetalleTablero", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((url: string, init?: RequestInit) => {
        if (init?.method === "POST" && url.includes("/secciones")) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ id: "s2", tablero_id: "t1", nombre: "Sección nueva", orden: 1 }),
          });
        }
        if (url.includes("/secciones/") && url.includes("/salidas")) {
          return Promise.resolve({ ok: true, json: async () => [] });
        }
        if (url.includes("/tableros/t1/secciones")) {
          return Promise.resolve({
            ok: true,
            json: async () => [{ id: "s1", tablero_id: "t1", nombre: "Sección 1", orden: 0 }],
          });
        }
        if (init?.method === "PATCH") {
          return Promise.resolve({
            ok: true,
            json: async () => ({ ...tablero, nivel_falla_ka: "16.00" }),
          });
        }
        return Promise.resolve({ ok: true, json: async () => tablero });
      }),
    );
  });

  it("shows a selector tab for each existing sección, with the first one selected by default", async () => {
    renderDetalle();

    expect(await screen.findByRole("tab", { name: "Sección 1" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getAllByRole("table")).toHaveLength(1);
  });

  it("switches the visible sección when clicking another tab", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((url: string) => {
        if (url.includes("/secciones/s1/salidas") || url.includes("/secciones/s2/salidas")) {
          return Promise.resolve({ ok: true, json: async () => [] });
        }
        if (url.includes("/tableros/t1/secciones")) {
          return Promise.resolve({
            ok: true,
            json: async () => [
              { id: "s1", tablero_id: "t1", nombre: "Sección 1", orden: 0 },
              { id: "s2", tablero_id: "t1", nombre: "Sección 2", orden: 1 },
            ],
          });
        }
        return Promise.resolve({ ok: true, json: async () => tablero });
      }),
    );
    renderDetalle();
    await screen.findByRole("tab", { name: "Sección 1" });

    expect(screen.getAllByRole("table")).toHaveLength(1);
    expect(screen.getByRole("tab", { name: "Sección 1" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: "Sección 2" })).toHaveAttribute("aria-selected", "false");

    await userEvent.click(screen.getByRole("tab", { name: "Sección 2" }));

    expect(screen.getAllByRole("table")).toHaveLength(1);
    expect(screen.getByRole("tab", { name: "Sección 2" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: "Sección 1" })).toHaveAttribute("aria-selected", "false");
  });

  it("does not leak form values between secciones when switching tabs", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((url: string) => {
        if (url.includes("/secciones/s1/salidas") || url.includes("/secciones/s2/salidas")) {
          return Promise.resolve({ ok: true, json: async () => [] });
        }
        if (url.includes("/tableros/t1/secciones")) {
          return Promise.resolve({
            ok: true,
            json: async () => [
              { id: "s1", tablero_id: "t1", nombre: "Sección 1", orden: 0 },
              { id: "s2", tablero_id: "t1", nombre: "Sección 2", orden: 1 },
            ],
          });
        }
        return Promise.resolve({ ok: true, json: async () => tablero });
      }),
    );
    renderDetalle();
    await screen.findByRole("tab", { name: "Sección 1" });

    const cargaInputSeccion1 = screen.getAllByLabelText(/^carga$/i)[0] as HTMLInputElement;
    await userEvent.type(cargaInputSeccion1, "16");
    expect(cargaInputSeccion1.value).toBe("16");

    await userEvent.click(screen.getByRole("tab", { name: "Sección 2" }));

    const cargaInputSeccion2 = screen.getAllByLabelText(/^carga$/i)[0] as HTMLInputElement;
    expect(cargaInputSeccion2.value).toBe("");
  });

  it("shows the Nueva sección form directly when there are no secciones yet, with no selector", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((url: string) => {
        if (url.includes("/tableros/t1/secciones")) {
          return Promise.resolve({ ok: true, json: async () => [] });
        }
        return Promise.resolve({ ok: true, json: async () => tablero });
      }),
    );
    renderDetalle();

    expect(await screen.findByLabelText(/nueva sección/i)).toBeInTheDocument();
    expect(screen.queryByRole("tab")).not.toBeInTheDocument();
  });

  it("adds a new sección and adds a tab for it", async () => {
    renderDetalle();
    await screen.findByRole("tab", { name: "Sección 1" });

    await userEvent.type(screen.getByLabelText(/nueva sección/i), "Sección nueva");
    await userEvent.click(screen.getByRole("button", { name: /agregar sección/i }));

    expect(await screen.findByRole("tab", { name: "Sección nueva" })).toBeInTheDocument();
  });

  it("edits nivel de falla and reports the change upward", async () => {
    const onTableroActualizado = vi.fn();

    function Harness() {
      const [tableroActual, setTableroActual] = useState(tablero);
      return (
        <DetalleTablero
          tablero={tableroActual}
          onTableroActualizado={(actualizado) => {
            onTableroActualizado(actualizado);
            setTableroActual(actualizado);
          }}
          vista={{ zoom: 1, capas: { codigos: true, embarrado: true } }}
          onZoomChange={vi.fn()}
          onCapasChange={vi.fn()}
        />
      );
    }

    render(<Harness />);
    await screen.findByRole("tab", { name: "Sección 1" });

    await userEvent.click(screen.getByRole("button", { name: /editar nivel de falla/i }));
    const input = screen.getByLabelText(/nuevo nivel de falla/i) as HTMLInputElement;
    await userEvent.clear(input);
    await userEvent.type(input, "16");
    await userEvent.click(screen.getByRole("button", { name: /guardar/i }));

    expect(await screen.findByText(/nivel de falla.*16.00 kA/i)).toBeInTheDocument();
    expect(onTableroActualizado).toHaveBeenCalledWith(expect.objectContaining({ nivel_falla_ka: "16.00" }));
  });

  it("renders the EsquemaVisualCanvas with the given zoom", async () => {
    render(
      <DetalleTablero
        tablero={tablero}
        onTableroActualizado={vi.fn()}
        vista={{ zoom: 1.5, capas: { codigos: true, embarrado: true } }}
        onZoomChange={vi.fn()}
        onCapasChange={vi.fn()}
      />,
    );

    expect(await screen.findByRole("button", { name: /ajustar zoom/i })).toHaveTextContent("150%");
  });
});
