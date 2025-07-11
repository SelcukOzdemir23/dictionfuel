import GameContainer from '@/components/game-container';
import { getQuestions } from '@/lib/questions';
import type { Question } from '@/lib/questions';
import ThemeToggle from '@/components/ui/theme-toggle';
import { Toaster } from '@/components/ui/toaster';

export default async function Home() {
  const allQuestions: Question[] = await getQuestions();

  return (
    <main className="flex min-h-screen flex-col items-center justify-start p-4 sm:p-8 md:p-12 lg:p-24 bg-background pt-4">
      <div className="w-full max-w-2xl flex flex-col items-center gap-6 mb-8">
        <h1 className="text-4xl font-bold text-primary mb-2 text-center">Kelime Oyunu</h1>
        <ThemeToggle />
      </div>
      <GameContainer allQuestions={allQuestions} />
      <Toaster />
    </main>
  );
}
