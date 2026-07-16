import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CatalogoPage } from "./CatalogoPage";

describe("CatalogoPage", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ total_filas: 1, nuevos: 1, actualizados: 0, sin_cambios: 0 }),
      }),
    );
  });

  it("uploads the selected file and shows the summary", async () => {
    render(<CatalogoPage />);

    const file = new File(["contenido"], "abb.xlsx", {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const input = screen.getByLabelText(/archivo excel/i) as HTMLInputElement;
    await userEvent.upload(input, file);
    await userEvent.click(screen.getByRole("button", { name: /importar/i }));

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("/catalogo/importar"),
      expect.objectContaining({ method: "POST", credentials: "include" }),
    );
    expect(await screen.findByTestId("resumen")).toHaveTextContent("Nuevos: 1");
  });

  it("shows an error when no file is selected", async () => {
    render(<CatalogoPage />);

    await userEvent.click(screen.getByRole("button", { name: /importar/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/eleg/i);
  });
});
