import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { ProyectoWorkspacePage } from "./ProyectoWorkspacePage";

function renderPage(initialEntry = "/proyectos/p1") {
  render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path="/proyectos/:id" element={<ProyectoWorkspacePage />} />
      </Routes>
    </MemoryRouter>,
  );
}

function mockFetchConDosTableros() {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockImplementation((url: string) => {
      if (url.includes("/proyectos/p1/tableros")) {
        return Promise.resolve({
          ok: true,
          json: async () => [
            { id: "t1", proyecto_id: "p1", nombre: "TG1", nivel_falla_ka: "10.00", interruptor_principal_id: null },
            { id: "t2", proyecto_id: "p1", nombre: "TG2", nivel_falla_ka: "16.00", interruptor_principal_id: null },
          ],
        });
      }
      if (url.includes("/secciones")) {
        return Promise.resolve({ ok: true, json: async () => [] });
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({ id: "p1", cliente: "Cliente A", nombre: "Proyecto A", analista_id: "a1", estado: "en_curso" }),
      });
    }),
  );
}

describe("ProyectoWorkspacePage", () => {
  it("shows a tab per tablero and activates the first one by default", async () => {
    mockFetchConDosTableros();
    renderPage();

    expect(await screen.findByRole("tab", { name: "TG1" })).toHaveAttribute("aria-selected", "true");
    expect(await screen.findByRole("tab", { name: "TG2" })).toHaveAttribute("aria-selected", "false");
  });

  it("switches the active tablero when clicking another tab", async () => {
    mockFetchConDosTableros();
    renderPage();
    await screen.findByRole("tab", { name: "TG1" });

    await userEvent.click(screen.getByRole("tab", { name: "TG2" }));

    expect(screen.getByRole("tab", { name: "TG2" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: "TG1" })).toHaveAttribute("aria-selected", "false");
  });

  it("honors the tablero query param on load", async () => {
    mockFetchConDosTableros();
    renderPage("/proyectos/p1?tablero=t2");

    expect(await screen.findByRole("tab", { name: "TG2" })).toHaveAttribute("aria-selected", "true");
  });

  it("shows an empty state and no tabs when the proyecto has no tableros", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((url: string) => {
        if (url.includes("/tableros")) return Promise.resolve({ ok: true, json: async () => [] });
        return Promise.resolve({
          ok: true,
          json: async () => ({ id: "p1", cliente: "Cliente A", nombre: "Proyecto A", analista_id: "a1", estado: "en_curso" }),
        });
      }),
    );
    renderPage();

    expect(await screen.findByText(/creá tu primer tablero/i)).toBeInTheDocument();
    expect(screen.queryByRole("tab")).not.toBeInTheDocument();
  });

  it("falls back to the first tablero when the tablero query param doesn't match any real tablero", async () => {
    mockFetchConDosTableros();
    renderPage("/proyectos/p1?tablero=nonexistent");

    expect(await screen.findByRole("tab", { name: "TG1" })).toHaveAttribute("aria-selected", "true");
    expect(screen.queryByText(/creá tu primer tablero/i)).not.toBeInTheDocument();
  });

  it("creates a new tablero via the Nuevo tablero icon, adds a tab for it, and activates it", async () => {
    mockFetchConDosTableros();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((url: string, init?: RequestInit) => {
        if (init?.method === "POST") {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              id: "t3",
              proyecto_id: "p1",
              nombre: "TG3",
              nivel_falla_ka: "10.00",
              interruptor_principal_id: null,
            }),
          });
        }
        if (url.includes("/proyectos/p1/tableros")) {
          return Promise.resolve({
            ok: true,
            json: async () => [
              { id: "t1", proyecto_id: "p1", nombre: "TG1", nivel_falla_ka: "10.00", interruptor_principal_id: null },
            ],
          });
        }
        if (url.includes("/secciones")) {
          return Promise.resolve({ ok: true, json: async () => [] });
        }
        return Promise.resolve({
          ok: true,
          json: async () => ({ id: "p1", cliente: "Cliente A", nombre: "Proyecto A", analista_id: "a1", estado: "en_curso" }),
        });
      }),
    );
    renderPage();
    await screen.findByRole("tab", { name: "TG1" });

    await userEvent.click(screen.getByRole("button", { name: /^nuevo tablero$/i }));
    await userEvent.type(screen.getByLabelText(/^nombre$/i), "TG3");
    await userEvent.click(screen.getByRole("button", { name: /crear tablero/i }));

    expect(await screen.findByRole("tab", { name: "TG3" })).toHaveAttribute("aria-selected", "true");
  });

  it("shows the active tablero's secciones inside the workspace", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((url: string) => {
        if (url.includes("/proyectos/p1/tableros")) {
          return Promise.resolve({
            ok: true,
            json: async () => [
              { id: "t1", proyecto_id: "p1", nombre: "TG1", nivel_falla_ka: "10.00", interruptor_principal_id: null },
            ],
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
        return Promise.resolve({
          ok: true,
          json: async () => ({ id: "p1", cliente: "Cliente A", nombre: "Proyecto A", analista_id: "a1", estado: "en_curso" }),
        });
      }),
    );
    renderPage();

    expect(await screen.findByRole("heading", { name: "Sección 1" })).toBeInTheDocument();
  });

  it("keeps each tablero's zoom level when switching tabs and back", async () => {
    mockFetchConDosTableros();
    renderPage();
    await screen.findByRole("tab", { name: "TG1" });

    await userEvent.click(await screen.findByRole("button", { name: /acercar/i }));
    expect(screen.getByRole("button", { name: /ajustar zoom/i })).toHaveTextContent("125%");

    await userEvent.click(screen.getByRole("tab", { name: "TG2" }));
    expect(await screen.findByRole("button", { name: /ajustar zoom/i })).toHaveTextContent("100%");

    await userEvent.click(screen.getByRole("tab", { name: "TG1" }));
    expect(await screen.findByRole("button", { name: /ajustar zoom/i })).toHaveTextContent("125%");
  });

  it("shows a link back to Proyectos", async () => {
    mockFetchConDosTableros();
    renderPage();
    await screen.findByRole("tab", { name: "TG1" });

    expect(screen.getByRole("link", { name: /proyectos/i })).toHaveAttribute("href", "/proyectos");
  });

  it("shows the tablero management icons to the right of the tabs", async () => {
    mockFetchConDosTableros();
    renderPage();
    await screen.findByRole("tab", { name: "TG1" });

    expect(screen.getByRole("button", { name: /renombrar tablero activo/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /borrar tablero activo/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^nuevo tablero$/i })).toBeInTheDocument();
  });

  it("renames the active tablero via the icon and modal", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((url: string, init?: RequestInit) => {
        if (init?.method === "PATCH") {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              id: "t1",
              proyecto_id: "p1",
              nombre: "TG1 renombrado",
              nivel_falla_ka: "10.00",
              interruptor_principal_id: null,
            }),
          });
        }
        if (url.includes("/proyectos/p1/tableros")) {
          return Promise.resolve({
            ok: true,
            json: async () => [
              { id: "t1", proyecto_id: "p1", nombre: "TG1", nivel_falla_ka: "10.00", interruptor_principal_id: null },
            ],
          });
        }
        if (url.includes("/secciones")) return Promise.resolve({ ok: true, json: async () => [] });
        return Promise.resolve({
          ok: true,
          json: async () => ({ id: "p1", cliente: "Cliente A", nombre: "Proyecto A", analista_id: "a1", estado: "en_curso" }),
        });
      }),
    );
    renderPage();
    await screen.findByRole("tab", { name: "TG1" });

    await userEvent.click(screen.getByRole("button", { name: /renombrar tablero activo/i }));
    const input = screen.getByLabelText(/^nombre$/i) as HTMLInputElement;
    expect(input.value).toBe("TG1");
    await userEvent.clear(input);
    await userEvent.type(input, "TG1 renombrado");
    await userEvent.click(screen.getByRole("button", { name: /^guardar$/i }));

    expect(await screen.findByRole("tab", { name: "TG1 renombrado" })).toBeInTheDocument();
  });

  it("deletes the active tablero after confirming and falls back to another tab", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((url: string, init?: RequestInit) => {
        if (init?.method === "DELETE") return Promise.resolve({ ok: true, json: async () => ({}) });
        if (url.includes("/proyectos/p1/tableros")) {
          return Promise.resolve({
            ok: true,
            json: async () => [
              { id: "t1", proyecto_id: "p1", nombre: "TG1", nivel_falla_ka: "10.00", interruptor_principal_id: null },
              { id: "t2", proyecto_id: "p1", nombre: "TG2", nivel_falla_ka: "16.00", interruptor_principal_id: null },
            ],
          });
        }
        if (url.includes("/secciones")) return Promise.resolve({ ok: true, json: async () => [] });
        return Promise.resolve({
          ok: true,
          json: async () => ({ id: "p1", cliente: "Cliente A", nombre: "Proyecto A", analista_id: "a1", estado: "en_curso" }),
        });
      }),
    );
    renderPage();
    await screen.findByRole("tab", { name: "TG1" });

    await userEvent.click(screen.getByRole("button", { name: /borrar tablero activo/i }));
    await userEvent.click(screen.getByRole("button", { name: /^borrar$/i }));

    expect(await screen.findByRole("tab", { name: "TG2" })).toHaveAttribute("aria-selected", "true");
    expect(screen.queryByRole("tab", { name: "TG1" })).not.toBeInTheDocument();
  });

  it("cancelling the tablero delete confirmation keeps the tablero", async () => {
    mockFetchConDosTableros();
    renderPage();
    await screen.findByRole("tab", { name: "TG1" });

    await userEvent.click(screen.getByRole("button", { name: /borrar tablero activo/i }));
    await userEvent.click(screen.getByRole("button", { name: /cancelar/i }));

    expect(screen.getByRole("tab", { name: "TG1" })).toBeInTheDocument();
  });

  it("shows an error and keeps the dialog open if deleting the tablero fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((url: string, init?: RequestInit) => {
        if (init?.method === "DELETE") return Promise.resolve({ ok: false });
        if (url.includes("/proyectos/p1/tableros")) {
          return Promise.resolve({
            ok: true,
            json: async () => [
              { id: "t1", proyecto_id: "p1", nombre: "TG1", nivel_falla_ka: "10.00", interruptor_principal_id: null },
            ],
          });
        }
        if (url.includes("/secciones")) return Promise.resolve({ ok: true, json: async () => [] });
        return Promise.resolve({
          ok: true,
          json: async () => ({ id: "p1", cliente: "Cliente A", nombre: "Proyecto A", analista_id: "a1", estado: "en_curso" }),
        });
      }),
    );
    renderPage();
    await screen.findByRole("tab", { name: "TG1" });

    await userEvent.click(screen.getByRole("button", { name: /borrar tablero activo/i }));
    await userEvent.click(screen.getByRole("button", { name: /^borrar$/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/no se pudo borrar el tablero/i);
    expect(screen.getByRole("tab", { name: "TG1" })).toBeInTheDocument();
  });

  it("ignores a create-tablero response that resolves after the modal was cancelled", async () => {
    let resolvePost!: (value: { ok: boolean; json: () => Promise<unknown> }) => void;
    const postPromise = new Promise<{ ok: boolean; json: () => Promise<unknown> }>((resolve) => {
      resolvePost = resolve;
    });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((url: string, init?: RequestInit) => {
        if (init?.method === "POST") return postPromise;
        if (url.includes("/proyectos/p1/tableros")) {
          return Promise.resolve({
            ok: true,
            json: async () => [
              { id: "t1", proyecto_id: "p1", nombre: "TG1", nivel_falla_ka: "10.00", interruptor_principal_id: null },
            ],
          });
        }
        if (url.includes("/secciones")) return Promise.resolve({ ok: true, json: async () => [] });
        return Promise.resolve({
          ok: true,
          json: async () => ({ id: "p1", cliente: "Cliente A", nombre: "Proyecto A", analista_id: "a1", estado: "en_curso" }),
        });
      }),
    );
    renderPage();
    await screen.findByRole("tab", { name: "TG1" });

    await userEvent.click(screen.getByRole("button", { name: /^nuevo tablero$/i }));
    await userEvent.type(screen.getByLabelText(/^nombre$/i), "TG3");
    await userEvent.click(screen.getByRole("button", { name: /crear tablero/i }));
    await userEvent.keyboard("{Escape}");

    resolvePost({
      ok: true,
      json: async () => ({
        id: "t3",
        proyecto_id: "p1",
        nombre: "TG3",
        nivel_falla_ka: "10.00",
        interruptor_principal_id: null,
      }),
    });
    await postPromise;

    expect(screen.queryByRole("tab", { name: "TG3" })).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("ignores a rename-tablero response that resolves after the modal was cancelled", async () => {
    let resolvePatch!: (value: { ok: boolean; json: () => Promise<unknown> }) => void;
    const patchPromise = new Promise<{ ok: boolean; json: () => Promise<unknown> }>((resolve) => {
      resolvePatch = resolve;
    });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((url: string, init?: RequestInit) => {
        if (init?.method === "PATCH") return patchPromise;
        if (url.includes("/proyectos/p1/tableros")) {
          return Promise.resolve({
            ok: true,
            json: async () => [
              { id: "t1", proyecto_id: "p1", nombre: "TG1", nivel_falla_ka: "10.00", interruptor_principal_id: null },
            ],
          });
        }
        if (url.includes("/secciones")) return Promise.resolve({ ok: true, json: async () => [] });
        return Promise.resolve({
          ok: true,
          json: async () => ({ id: "p1", cliente: "Cliente A", nombre: "Proyecto A", analista_id: "a1", estado: "en_curso" }),
        });
      }),
    );
    renderPage();
    await screen.findByRole("tab", { name: "TG1" });

    await userEvent.click(screen.getByRole("button", { name: /renombrar tablero activo/i }));
    const input = screen.getByLabelText(/^nombre$/i) as HTMLInputElement;
    await userEvent.clear(input);
    await userEvent.type(input, "TG1 renombrado");
    await userEvent.click(screen.getByRole("button", { name: /^guardar$/i }));
    await userEvent.keyboard("{Escape}");

    resolvePatch({
      ok: true,
      json: async () => ({
        id: "t1",
        proyecto_id: "p1",
        nombre: "TG1 renombrado",
        nivel_falla_ka: "10.00",
        interruptor_principal_id: null,
      }),
    });
    await patchPromise;

    expect(screen.getByRole("tab", { name: "TG1" })).toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: "TG1 renombrado" })).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("does not close the Nuevo tablero modal when a mousedown starts inside it but the click resolves on the backdrop", async () => {
    mockFetchConDosTableros();
    renderPage();
    await screen.findByRole("tab", { name: "TG1" });

    await userEvent.click(screen.getByRole("button", { name: /^nuevo tablero$/i }));
    const dialog = screen.getByRole("dialog");
    const backdrop = dialog.parentElement!;
    fireEvent.mouseDown(dialog);
    fireEvent.click(backdrop);

    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("shows the backend's actual error message when creating a tablero fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((url: string, init?: RequestInit) => {
        if (init?.method === "POST") {
          return Promise.resolve({ ok: false, json: async () => ({ detail: "Nombre de tablero duplicado" }) });
        }
        if (url.includes("/proyectos/p1/tableros")) {
          return Promise.resolve({
            ok: true,
            json: async () => [
              { id: "t1", proyecto_id: "p1", nombre: "TG1", nivel_falla_ka: "10.00", interruptor_principal_id: null },
            ],
          });
        }
        if (url.includes("/secciones")) return Promise.resolve({ ok: true, json: async () => [] });
        return Promise.resolve({
          ok: true,
          json: async () => ({ id: "p1", cliente: "Cliente A", nombre: "Proyecto A", analista_id: "a1", estado: "en_curso" }),
        });
      }),
    );
    renderPage();
    await screen.findByRole("tab", { name: "TG1" });

    await userEvent.click(screen.getByRole("button", { name: /^nuevo tablero$/i }));
    await userEvent.type(screen.getByLabelText(/^nombre$/i), "TG1");
    await userEvent.click(screen.getByRole("button", { name: /crear tablero/i }));

    expect(await screen.findByText("Nombre de tablero duplicado")).toBeInTheDocument();
  });

  it("asks for confirmation before discarding the rename-tablero edit when closing via Cancelar", async () => {
    mockFetchConDosTableros();
    renderPage();
    await screen.findByRole("tab", { name: "TG1" });

    await userEvent.click(screen.getByRole("button", { name: /renombrar tablero activo/i }));
    await userEvent.click(screen.getByRole("button", { name: /^cancelar$/i }));

    expect(screen.getByText(/¿descartar cambios\?/i)).toBeInTheDocument();
  });

  it("does not ask for confirmation when cancelling the create-tablero modal", async () => {
    mockFetchConDosTableros();
    renderPage();
    await screen.findByRole("tab", { name: "TG1" });

    await userEvent.click(screen.getByRole("button", { name: /^nuevo tablero$/i }));
    await userEvent.click(screen.getByRole("button", { name: /^cancelar$/i }));

    expect(screen.queryByText(/¿descartar cambios\?/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("dialog", { name: /nuevo tablero/i })).not.toBeInTheDocument();
  });
});
