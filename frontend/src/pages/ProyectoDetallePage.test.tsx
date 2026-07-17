import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { ProyectoDetallePage } from "./ProyectoDetallePage";

function renderPage() {
  render(
    <MemoryRouter initialEntries={["/proyectos/p1"]}>
      <Routes>
        <Route path="/proyectos/:id" element={<ProyectoDetallePage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("ProyectoDetallePage", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((url: string, init?: RequestInit) => {
        if (init?.method === "POST") {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              id: "t2",
              proyecto_id: "p1",
              nombre: "TG2",
              nivel_falla_ka: "10.00",
              interruptor_principal_id: null,
            }),
          });
        }
        if (url.includes("/tableros")) {
          return Promise.resolve({
            ok: true,
            json: async () => [
              { id: "t1", proyecto_id: "p1", nombre: "TG1", nivel_falla_ka: "10.00", interruptor_principal_id: null },
            ],
          });
        }
        return Promise.resolve({
          ok: true,
          json: async () => ({ id: "p1", cliente: "Cliente A", nombre: "Proyecto A", analista_id: "a1", estado: "en_curso" }),
        });
      }),
    );
  });

  it("shows the project and its existing tableros", async () => {
    renderPage();

    expect(await screen.findByText("Proyecto A")).toBeInTheDocument();
    expect(await screen.findByText("TG1")).toBeInTheDocument();
  });

  it("creates a new tablero and adds it to the list", async () => {
    renderPage();
    await screen.findByText("TG1");

    await userEvent.type(screen.getByLabelText(/^nombre$/i), "TG2");
    await userEvent.click(screen.getByRole("button", { name: /crear tablero/i }));

    expect(await screen.findByText("TG2")).toBeInTheDocument();
  });

  it("defaults nivel de falla to a standard value so it doesn't block starting a tablero", async () => {
    renderPage();
    await screen.findByText("TG1");

    const nivelFalla = screen.getByLabelText(/nivel de falla/i) as HTMLInputElement;

    expect(nivelFalla.value).toBe("10");
  });
});
