import { LoginForm } from "./LoginForm";
import { signInWithGoogle } from "./actions";

const ERRORS: Record<string, string> = {
  no_access: "ამ ანგარიშს სისტემაში შესვლის უფლება არ აქვს. მიმართეთ ადმინისტრატორს.",
  google: "Google-ით შესვლა ვერ მოხერხდა.",
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <div className="card w-full max-w-sm space-y-5 p-6">
        <div className="text-center">
          <div className="text-3xl">🎥</div>
          <h1 className="mt-2 text-lg font-semibold">პრეს ცენტრის მართვის ცენტრი</h1>
        </div>
        {error && ERRORS[error] && (
          <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{ERRORS[error]}</p>
        )}
        <form action={signInWithGoogle}>
          <button className="btn-secondary w-full">
            <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
              <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.3-.4-3.5z"/>
              <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/>
              <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/>
              <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.3-.4-3.5z"/>
            </svg>
            Google-ით შესვლა
          </button>
        </form>
        <div className="flex items-center gap-3 text-xs text-gray-400">
          <div className="h-px flex-1 bg-gray-200" /> ან <div className="h-px flex-1 bg-gray-200" />
        </div>
        <LoginForm />
      </div>
    </main>
  );
}
