import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { ProyectosPage } from "./ProyectosPage";

describe("ProyectosPage", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((_url: string, init?: RequestInit) => {
        if (init?.method === "POST") {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              id: "p2",
              cliente: "Cliente Nuevo",
              nombre: "Proyecto Nuevo",
              analista_id: "a1",
              estado: "en_curso",
            }),
          });
        }
        return Promise.resolve({
          ok: true,
          json: async () => [{ id: "p1", cliente: "Cliente A", nombre: "Proyecto Existente", analista_id: "a1", estado: "en_curso" }],
        });
      }),
    );
  });

  it("lists existing projects as cards", async () => {
    render(
      <MemoryRouter>
        <ProyectosPage />
      </MemoryRouter>,
    );

    expect(await screen.findByText(/Proyecto Existente/i)).toBeInTheDocument();
  });

  it("does not show the creation form until the button is clicked", async () => {
    render(
      <MemoryRouter>
        <ProyectosPage />
      </MemoryRouter>,
    );
    await screen.findByText(/Proyecto Existente/i);

    expect(screen.queryByLabelText(/^cliente$/i)).not.toBeInTheDocument();
  });

  it("opens the modal, creates a new project, and adds it to the list", async () => {
    render(
      <MemoryRouter>
        <ProyectosPage />
      </MemoryRouter>,
    );
    await screen.findByText(/Proyecto Existente/i);

    await userEvent.click(screen.getByRole("button", { name: /nuevo proyecto/i }));
    await userEvent.type(screen.getByLabelText(/^cliente$/i), "Cliente Nuevo");
    await userEvent.type(screen.getByLabelText(/^nombre$/i), "Proyecto Nuevo");
    await userEvent.click(screen.getByRole("button", { name: /crear proyecto/i }));

    expect(await screen.findByText(/Proyecto Nuevo/i)).toBeInTheDocument();
  });
});
