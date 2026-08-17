"use client";

import { useState, FormEvent } from "react";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ErrorBanner } from "@/components/ui/error-banner";

export default function RegisterPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Não foi possível criar a conta.");
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado.");
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <div className="space-y-3 text-center">
        <h1 className="text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">Cadastro enviado</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Sua conta foi criada e está aguardando a aprovação de um administrador. Você vai
          conseguir entrar assim que ela for aprovada.
        </p>
        <Link href="/login" className="text-sm font-medium text-brand-primary hover:underline">
          Voltar para o login
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">Criar conta</h1>
        <p className="mt-0.5 text-sm text-zinc-500 dark:text-zinc-400">Cadastre-se no Atlas</p>
      </div>

      {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}

      <Input label="Nome" value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
      <Input label="E-mail" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
      <div className="space-y-1.5">
        <Input
          label="Senha"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          minLength={8}
          required
        />
        <p className="text-xs text-zinc-400">Mínimo de 8 caracteres.</p>
      </div>

      <Button type="submit" disabled={loading} className="w-full">
        {loading ? "Criando conta..." : "Criar conta"}
      </Button>

      <p className="text-center text-sm text-zinc-500 dark:text-zinc-400">
        Já tem uma conta?{" "}
        <Link href="/login" className="font-medium text-brand-primary hover:underline">
          Entrar
        </Link>
      </p>
    </form>
  );
}
