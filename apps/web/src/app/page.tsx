import Link from "next/link";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <nav className="container mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="text-2xl font-bold text-indigo-600">Lia 360</div>
          <div className="space-x-4">
            <Link href="/login" className="text-gray-600 hover:text-gray-900">
              Entrar
            </Link>
            <Link
              href="/register"
              className="rounded-lg bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-700"
            >
              Começar Grátis
            </Link>
          </div>
        </div>
      </nav>

      <main className="container mx-auto px-6 py-20">
        <div className="text-center">
          <h1 className="text-5xl font-bold text-gray-900 md:text-6xl">
            Transforme interações em{" "}
            <span className="text-indigo-600">vendas</span>
          </h1>
          <p className="mt-6 text-xl text-gray-600">
            Importe leads de 15+ redes sociais, automatize seu outreach e
            centralize todas as conversas em um único lugar.
          </p>
          <div className="mt-10 flex justify-center gap-4">
            <Link
              href="/register"
              className="rounded-lg bg-indigo-600 px-8 py-3 text-lg font-semibold text-white hover:bg-indigo-700"
            >
              Começar Grátis
            </Link>
            <Link
              href="#features"
              className="rounded-lg border border-gray-300 px-8 py-3 text-lg font-semibold text-gray-700 hover:bg-gray-50"
            >
              Saiba Mais
            </Link>
          </div>
        </div>

        <div id="features" className="mt-32 grid gap-8 md:grid-cols-3">
          <div className="rounded-xl bg-white p-8 shadow-lg">
            <div className="mb-4 inline-block rounded-lg bg-indigo-100 p-3">
              <svg
                className="h-6 w-6 text-indigo-600"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zM12.75 12a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z"
                />
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-gray-900">
              Importação Inteligente
            </h3>
            <p className="mt-2 text-gray-600">
              Importe leads de Instagram, Facebook, LinkedIn e mais 12
              plataformas com nossa extensão.
            </p>
          </div>

          <div className="rounded-xl bg-white p-8 shadow-lg">
            <div className="mb-4 inline-block rounded-lg bg-green-100 p-3">
              <svg
                className="h-6 w-6 text-green-600"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                />
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-gray-900">
              Inbox Unificado
            </h3>
            <p className="mt-2 text-gray-600">
              Todas as suas conversas em um só lugar. Responda leads de qualquer
              plataforma sem trocar de aba.
            </p>
          </div>
        </div>
      </main>

      <footer className="mt-20 border-t bg-white py-8">
        <div className="container mx-auto px-6 text-center text-gray-600">
          <p>&copy; 2026 Lia 360. Todos os direitos reservados.</p>
        </div>
      </footer>
    </div>
  );
}
