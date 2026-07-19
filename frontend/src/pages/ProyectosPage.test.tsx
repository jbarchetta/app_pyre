import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
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

  it("closing via Cancelar clears the form and does not create a project", async () => {
    render(
      <MemoryRouter>
        <ProyectosPage />
      </MemoryRouter>,
    );
    await screen.findByText(/Proyecto Existente/i);

    await userEvent.click(screen.getByRole("button", { name: /nuevo proyecto/i }));
    await userEvent.type(screen.getByLabelText(/^cliente$/i), "Algo tipeado");
    await userEvent.click(screen.getByRole("button", { name: /cancelar/i }));

    expect(screen.queryByLabelText(/^cliente$/i)).not.toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ method: "POST" }));

    await userEvent.click(screen.getByRole("button", { name: /nuevo proyecto/i }));
    expect((screen.getByLabelText(/^cliente$/i) as HTMLInputElement).value).toBe("");
  });

  it("edits a project's nombre and cliente via the edit icon", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((_url: string, init?: RequestInit) => {
        if (init?.method === "PATCH") {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              id: "p1",
              cliente: "Cliente Editado",
              nombre: "Proyecto Editado",
              analista_id: "a1",
              estado: "en_curso",
            }),
          });
        }
        return Promise.resolve({
          ok: true,
          json: async () => [
            { id: "p1", cliente: "Cliente A", nombre: "Proyecto Existente", analista_id: "a1", estado: "en_curso" },
          ],
        });
      }),
    );
    render(
      <MemoryRouter>
        <ProyectosPage />
      </MemoryRouter>,
    );
    await screen.findByText(/Proyecto Existente/i);

    await userEvent.click(screen.getByRole("button", { name: /editar proyecto existente/i }));
    const nombreInput = screen.getByLabelText(/^nombre$/i) as HTMLInputElement;
    expect(nombreInput.value).toBe("Proyecto Existente");
    await userEvent.clear(nombreInput);
    await userEvent.type(nombreInput, "Proyecto Editado");
    await userEvent.click(screen.getByRole("button", { name: /^guardar$/i }));

    expect(await screen.findByText(/Proyecto Editado/i)).toBeInTheDocument();
  });

  it("deletes a project after confirming, showing how many tableros it has", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((url: string, init?: RequestInit) => {
        if (init?.method === "DELETE") return Promise.resolve({ ok: true, json: async () => ({}) });
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
          json: async () => [
            { id: "p1", cliente: "Cliente A", nombre: "Proyecto Existente", analista_id: "a1", estado: "en_curso" },
          ],
        });
      }),
    );
    render(
      <MemoryRouter>
        <ProyectosPage />
      </MemoryRouter>,
    );
    await screen.findByText(/Proyecto Existente/i);

    await userEvent.click(screen.getByRole("button", { name: /borrar proyecto existente/i }));
    expect(await screen.findByText(/1 tablero/i)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /^borrar$/i }));

    await waitFor(() => expect(screen.queryByText(/Proyecto Existente/i)).not.toBeInTheDocument());
  });

  it("cancelling the delete confirmation keeps the project", async () => {
    render(
      <MemoryRouter>
        <ProyectosPage />
      </MemoryRouter>,
    );
    await screen.findByText(/Proyecto Existente/i);

    await userEvent.click(screen.getByRole("button", { name: /borrar proyecto existente/i }));
    await screen.findByRole("dialog");
    await userEvent.click(screen.getByRole("button", { name: /cancelar/i }));

    expect(screen.getByText(/Proyecto Existente/i)).toBeInTheDocument();
  });

  it("does not close the modal when a mousedown starts inside it but the click resolves on the backdrop", async () => {
    render(
      <MemoryRouter>
        <ProyectosPage />
      </MemoryRouter>,
    );
    await screen.findByText(/Proyecto Existente/i);

    await userEvent.click(screen.getByRole("button", { name: /nuevo proyecto/i }));
    const dialog = screen.getByRole("dialog");
    const backdrop = dialog.parentElement!;
    fireEvent.mouseDown(dialog);
    fireEvent.click(backdrop);

    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
});
