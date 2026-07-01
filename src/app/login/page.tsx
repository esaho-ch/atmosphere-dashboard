export default function LoginPage({ searchParams }: { searchParams: { error?: string } }) {
  const errorMessages: Record<string, string> = {
    access_denied: "Accès refusé par Bexio.",
    token_failed: "Erreur lors de l'échange du token. Réessaie.",
  };
  const errorMsg = searchParams.error ? errorMessages[searchParams.error] : null;

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="bg-white rounded-2xl border border-gray-200 p-10 w-full max-w-sm text-center shadow-sm">
        <div className="text-3xl font-bold text-gray-900 mb-1">Atmosphere</div>
        <div className="text-sm text-gray-500 mb-8">Dashboard Marges</div>

        {errorMsg && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
            {errorMsg}
          </div>
        )}

        <a
          href="/api/auth/login"
          className="flex items-center justify-center gap-3 w-full bg-gray-900 text-white rounded-xl px-5 py-3 text-sm font-semibold hover:bg-gray-700 transition"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9V8h2v8zm4 0h-2V8h2v8z"/>
          </svg>
          Se connecter avec Bexio
        </a>

        <p className="mt-6 text-xs text-gray-400">
          Seuls les utilisateurs du compte Bexio d'Atmosphere ont accès.
        </p>
      </div>
    </div>
  );
}
