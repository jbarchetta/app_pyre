import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ComponentePicker } from "./ComponentePicker";

describe("ComponentePicker", () => {
  it("does not search with fewer than 2 characters", async () => {
    vi.stubGlobal("fetch", vi.fn());
    render(<ComponentePicker onSelect={vi.fn()} />);

    await userEvent.type(screen.getByLabelText(/buscar código/i), "a");

    expect(fetch).not.toHaveBeenCalled();
  });

  it("shows results and calls onSelect when clicked", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          resultados: [{ id: "c1", codigo: "SH201-C16", descripcion: "Interruptor 16A", precio_neto: "50.00" }],
          total: 1,
        }),
      }),
    );
    const onSelect = vi.fn();
    render(<ComponentePicker onSelect={onSelect} />);

    await userEvent.type(screen.getByLabelText(/buscar código/i), "SH201");
    await userEvent.click(await screen.findByRole("button", { name: /SH201-C16/i }));

    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: "c1", codigo: "SH201-C16" }));
  });

  it("shows 'sin resultados' when the search returns nothing", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({ resultados: [], total: 0 }) }),
    );
    render(<ComponentePicker onSelect={vi.fn()} />);

    await userEvent.type(screen.getByLabelText(/buscar código/i), "zzzz");

    expect(await screen.findByText(/sin resultados/i)).toBeInTheDocument();
  });

  it("shows a result count and no 'Cargar más' button when everything fits", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          resultados: [{ id: "c1", codigo: "SH201-C16", descripcion: "Interruptor 16A", precio_neto: "50.00" }],
          total: 1,
        }),
      }),
    );
    render(<ComponentePicker onSelect={vi.fn()} />);

    await userEvent.type(screen.getByLabelText(/buscar código/i), "SH201");

    expect(await screen.findByText(/mostrando 1 de 1 resultados/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /cargar más/i })).not.toBeInTheDocument();
  });

  it("loads more results without replacing the ones already shown", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((url: string) => {
        const esSegundaPagina = url.includes("offset=1");
        return Promise.resolve({
          ok: true,
          json: async () =>
            esSegundaPagina
              ? {
                  resultados: [{ id: "c2", codigo: "SH201-C20", descripcion: "Interruptor 20A", precio_neto: "55.00" }],
                  total: 2,
                }
              : {
                  resultados: [{ id: "c1", codigo: "SH201-C16", descripcion: "Interruptor 16A", precio_neto: "50.00" }],
                  total: 2,
                },
        });
      }),
    );
    render(<ComponentePicker onSelect={vi.fn()} />);

    await userEvent.type(screen.getByLabelText(/buscar código/i), "SH201");
    await screen.findByText(/mostrando 1 de 2 resultados/i);

    await userEvent.click(screen.getByRole("button", { name: /cargar más/i }));

    expect(await screen.findByRole("button", { name: /SH201-C20/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /SH201-C16/i })).toBeInTheDocument();
    expect(screen.getByText(/mostrando 2 de 2 resultados/i)).toBeInTheDocument();
  });
});
