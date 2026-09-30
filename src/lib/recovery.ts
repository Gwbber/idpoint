/** Detecta se a URL atual veio de um link de definição/recuperação de senha. */
export function isRecoveryUrl(): boolean {
  if (typeof window === "undefined") return false;
  const hash = window.location.hash.startsWith("#")
    ? window.location.hash.slice(1)
    : window.location.hash;
  const hashParams = new URLSearchParams(hash);
  const queryParams = new URLSearchParams(window.location.search);
  const type = hashParams.get("type") ?? queryParams.get("type");
  if (type === "recovery" || type === "invite" || type === "signup") return true;
  // Link estilo PKCE: ?code=... vindo do e-mail de recuperação
  return Boolean(queryParams.get("code")) && queryParams.get("flow") !== "login";
}

/** Preserva os parâmetros do link ao encaminhar para a tela de nova senha. */
export function recoveryTargetUrl(): string {
  return `/redefinir-senha${window.location.search}${window.location.hash}`;
}
