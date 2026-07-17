import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { TableroPage } from "./TableroPage";

function renderPage() {
  render(
    <MemoryRouter initialEntries={["/tableros/t1"]}>
      <Routes>
        <Route path="/tableros/:id" element={<TableroPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("TableroPage", () => {
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
            json: async () => ({
              id: "t1",
              proyecto_id: "p1",
              nombre: "TG1",
              nivel_falla_ka: "16.00",
              interruptor_principal_id: "c1",
            }),
          });
        }
        return Promise.resolve({
          ok: true,
          json: async () => ({
            id: "t1",
            proyecto_id: "p1",
            nombre: "TG1",
            nivel_falla_ka: "10.00",
            interruptor_principal_id: "c1",
          }),
        });
      }),
    );
  });

  it("shows the tablero header and its existing secciones", async () => {
    renderPage();

    expect(await screen.findByText("TG1")).toBeInTheDocument();
    expect(await screen.findByText("Sección 1")).toBeInTheDocument();
  });

  it("adds a new sección", async () => {
    renderPage();
    await screen.findByText("Sección 1");

    await userEvent.type(screen.getByLabelText(/nueva sección/i), "Sección nueva");
    await userEvent.click(screen.getByRole("button", { name: /agregar sección/i }));

    expect(await screen.findByText("Sección nueva")).toBeInTheDocument();
  });

  it("edits nivel de falla so it doesn't stay locked at the value chosen when starting the tablero", async () => {
    renderPage();
    await screen.findByText("TG1");

    await userEvent.click(screen.getByRole("button", { name: /editar/i }));
    const input = screen.getByLabelText(/nuevo nivel de falla/i) as HTMLInputElement;
    await userEvent.clear(input);
    await userEvent.type(input, "16");
    await userEvent.click(screen.getByRole("button", { name: /guardar/i }));

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("/tableros/t1"),
      expect.objectContaining({ method: "PATCH" }),
    );
    expect(await screen.findByText(/nivel de falla: 16.00 kA/i)).toBeInTheDocument();
  });
});
