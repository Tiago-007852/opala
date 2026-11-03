import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, LogIn, UserPlus, ShieldCheck, Eye, EyeOff, AlertCircle, CheckCircle2 } from "lucide-react";
import type { SiteAccount } from "../types";

export type AccountMode = "login" | "register";

interface AccountModalProps {
  open: boolean;
  mode: AccountMode;
  onClose: () => void;
  onAuthenticated: (account: SiteAccount) => void;
  onSwitchMode: (mode: AccountMode) => void;
}

/** Traduz a resposta da API para o formato que o App guarda. */
export function toSiteAccount(payload: any): SiteAccount | null {
  if (payload?.kind === "admin" && payload.admin) {
    return {
      kind: "admin",
      id: payload.admin.id,
      name: payload.admin.name || "Administração",
      email: payload.admin.email,
      phone: "",
      role: payload.admin.role,
    };
  }
  const customer = payload?.customer;
  if (customer) {
    return {
      kind: "customer",
      id: customer.id,
      customerId: customer.customerId,
      name: customer.name,
      email: customer.email,
      phone: customer.phone,
    };
  }
  return null;
}

const inputClass =
  "w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-white/30 focus:outline-none focus:border-gold/60 transition-colors";

export default function AccountModal({ open, mode, onClose, onAuthenticated, onSwitchMode }: AccountModalProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  // Limpa avisos apenas quando o modal abre — mudar de separador não pode
  // apagar a explicação que acabámos de mostrar.
  useEffect(() => {
    if (!open) return;
    setError("");
    setNotice("");
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    setNotice("");
    setBusy(true);

    try {
      const url = mode === "login" ? "/api/customer/login" : "/api/customer/register";
      const body =
        mode === "login"
          ? { email: email.trim(), password }
          : { name: name.trim(), email: email.trim(), phone: phone.trim(), password };

      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        if (data.code === "admin_email") {
          // É o e-mail do dono: a conta existe como administração. Mantemos o
          // formulário aberto para poder introduzir a palavra-passe do painel.
          setNotice(
            data.error ??
              "Este e-mail é a conta de administração: introduza a palavra-passe do painel para entrar."
          );
          return;
        }
        if (data.code === "email_taken") {
          onSwitchMode("login");
          setNotice("Já tem conta. Introduza a palavra-passe para entrar.");
          return;
        }
        const suffix = typeof data.attemptsLeft === "number" ? ` Tentativas restantes: ${data.attemptsLeft}.` : "";
        // Se o servidor não devolver JSON (ex.: site estático, sem API), o
        // código HTTP é a única pista útil para o utilizador.
        setError(`${data.error ?? `Não foi possível continuar (HTTP ${res.status}).`}${suffix}`);
        return;
      }

      const account = toSiteAccount(data);
      if (!account) {
        setError("Resposta inesperada do servidor.");
        return;
      }

      setPassword("");
      onAuthenticated(account);
      onClose();
    } catch {
      setError("Sem ligação ao servidor. Tente novamente.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.98 }}
            transition={{ duration: 0.25 }}
            onClick={(event) => event.stopPropagation()}
            className="relative w-full max-w-md bg-[#0d0d0d] border border-white/10 rounded-3xl p-8 shadow-2xl"
            id="account-modal"
          >
            <button
              onClick={onClose}
              aria-label="Fechar"
              className="absolute top-5 right-5 text-white/40 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.3em] text-gold/80 font-semibold">
              <ShieldCheck className="w-3.5 h-3.5" />
              Conta Opala
            </div>
            <h2 className="mt-3 font-serif text-2xl text-white">
              {mode === "login" ? "Entrar na sua conta" : "Criar conta"}
            </h2>
            <p className="mt-2 text-xs text-white/50 leading-relaxed">
              {mode === "login"
                ? "As suas reservas e pedidos ficam ligados ao mesmo perfil."
                : "Guarde os seus dados uma vez — as reservas passam a vir preenchidas."}
            </p>

            <form onSubmit={submit} className="mt-7 space-y-4">
              {mode === "register" && (
                <div>
                  <label htmlFor="account-name" className="block text-[10px] uppercase tracking-[0.2em] text-white/50 mb-2">
                    Nome completo
                  </label>
                  <input
                    id="account-name"
                    className={inputClass}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Ex.: Tiago Silva"
                    autoComplete="name"
                    required
                  />
                </div>
              )}

              <div>
                <label htmlFor="account-email" className="block text-[10px] uppercase tracking-[0.2em] text-white/50 mb-2">
                  E-mail
                </label>
                <input
                  id="account-email"
                  type="email"
                  className={inputClass}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="nome@exemplo.com"
                  autoComplete="email"
                  required
                />
              </div>

              {mode === "register" && (
                <div>
                  <label htmlFor="account-phone" className="block text-[10px] uppercase tracking-[0.2em] text-white/50 mb-2">
                    Telefone
                  </label>
                  <input
                    id="account-phone"
                    className={inputClass}
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+244 923 000 000"
                    autoComplete="tel"
                  />
                </div>
              )}

              <div>
                <label htmlFor="account-password" className="block text-[10px] uppercase tracking-[0.2em] text-white/50 mb-2">
                  Palavra-passe
                </label>
                <div className="relative">
                  <input
                    id="account-password"
                    type={showPassword ? "text" : "password"}
                    className={`${inputClass} pr-12`}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={mode === "register" ? "Mínimo 12 caracteres, símbolos e números" : "A sua palavra-passe"}
                    autoComplete={mode === "register" ? "new-password" : "current-password"}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? "Esconder palavra-passe" : "Mostrar palavra-passe"}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-white/40 hover:text-white transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {notice && (
                <div className="flex items-start gap-2 text-xs text-amber-300/90 bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-3">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{notice}</span>
                </div>
              )}

              {error && (
                <div className="flex items-start gap-2 text-xs text-red-300 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={busy}
                id="account-submit"
                className="w-full flex items-center justify-center gap-2 bg-gold text-black font-semibold text-xs uppercase tracking-[0.2em] py-3.5 rounded-xl hover:bg-amber-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {mode === "login" ? <LogIn className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
                {busy ? "A processar…" : mode === "login" ? "Entrar" : "Criar conta"}
              </button>
            </form>

            <div className="mt-6 text-center text-xs text-white/50">
              {mode === "login" ? (
                <>
                  Ainda não tem conta?{" "}
                  <button onClick={() => onSwitchMode("register")} className="text-gold hover:underline font-medium">
                    Criar agora
                  </button>
                </>
              ) : (
                <>
                  Já tem conta?{" "}
                  <button onClick={() => onSwitchMode("login")} className="text-gold hover:underline font-medium">
                    Entrar
                  </button>
                </>
              )}
            </div>

            {mode === "register" && (
              <p className="mt-4 flex items-start gap-2 text-[10px] leading-relaxed text-white/35">
                <CheckCircle2 className="w-3 h-3 shrink-0 mt-0.5" />
                Contas do site não dão acesso ao painel de gestão.
              </p>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
