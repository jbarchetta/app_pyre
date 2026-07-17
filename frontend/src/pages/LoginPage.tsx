import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { login } from "../api/client";

export function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      await login(email, password);
      navigate("/");
    } catch {
      setError("Credenciales inválidas");
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface">
      <form
        onSubmit={handleSubmit}
        className="flex w-96 flex-col gap-3 border border-surface-stroke bg-white p-8"
      >
        <h1 className="text-xl font-bold text-abb-red">Configurador de Tableros PYRE</h1>
        <label htmlFor="email">Email</label>
        <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <label htmlFor="password">Contraseña</label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        {error && <p role="alert" className="text-error">{error}</p>}
        <button type="submit" className="mt-2 bg-abb-red px-6 py-3 text-sm uppercase tracking-widest text-white">
          Ingresar
        </button>
      </form>
    </div>
  );
}
