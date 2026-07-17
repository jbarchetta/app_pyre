import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ParametrosCalculoPage } from "./ParametrosCalculoPage";

describe("ParametrosCalculoPage", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          tension_mono_v: "220.00",
          tension_tri_v: "380.00",
          cos_phi: "0.90",
          ratio_selectividad: "1.60",
        }),
      }),
    );
  });

  it("loads and saves the calculation parameters", async () => {
    render(<ParametrosCalculoPage />);

    const tensionMono = (await screen.findByLabelText(/tensión monofásica/i)) as HTMLInputElement;
    expect(tensionMono.value).toBe("220.00");

    await userEvent.clear(tensionMono);
    await userEvent.type(tensionMono, "230");
    await userEvent.click(screen.getByRole("button", { name: /guardar/i }));

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("/parametros-calculo"),
      expect.objectContaining({ method: "PUT" }),
    );
    expect(await screen.findByText(/guardado/i)).toBeInTheDocument();
  });
});
