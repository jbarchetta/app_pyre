import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { CotizacionBomPage } from "./CotizacionBomPage";

describe("CotizacionBomPage", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((url: string) => {
        if (url.includes("/bom")) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              proyecto_id: "p1",
              proyecto_nombre: "Proyecto Demo BOM",
              tableros: [
                {
                  tablero_id: "t1",
                  tablero_nombre: "TG1",
                  lineas: [],
                  total_items_count: 0,
                  costo_total: 0,
                  fecha_congelamiento: null,
                },
              ],
              costo_total_proyecto: 15000,
            }),
          });
        }
        if (url.includes("/tableros")) {
          return Promise.resolve({
            ok: true,
            json: async () => [{ id: "t1", proyecto_id: "p1", nombre: "TG1" }],
          });
        }
        if (url.includes("/proyectos")) {
          return Promise.resolve({
            ok: true,
            json: async () => [
              { id: "p1", cliente: "Cliente Demo", nombre: "Proyecto Demo BOM", analista_id: "a1" },
            ],
          });
        }
        return Promise.resolve({ ok: true, json: async () => ({}) });
      }),
    );
  });

  it("renders the BOM page title and project selector", async () => {
    render(
      <MemoryRouter>
        <CotizacionBomPage />
      </MemoryRouter>,
    );

    expect(await screen.findByText(/MÓDULO DE COTIZACIÓN Y MATERIALES/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Proyecto Demo BOM/i).length).toBeGreaterThan(0);
  });

  it("allows switching board filter", async () => {
    render(
      <MemoryRouter>
        <CotizacionBomPage />
      </MemoryRouter>,
    );

    const selectTablero = await screen.findByLabelText(/Tablero/i);
    const optionTg1 = await screen.findByRole("option", { name: "TG1" });
    await userEvent.selectOptions(selectTablero, optionTg1);
    expect(selectTablero).toHaveValue("t1");
  });
});
