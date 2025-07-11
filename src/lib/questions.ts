import fs from 'fs/promises';
import path from 'path';

export type Question = {
  options: [string, string];
  correctAnswer: number;
  explanation: string;
};

function parseCSV(csv: string): { correct: string, wrong: string, explanation: string }[] {
  const lines = csv.trim().split('\n');
  if (lines.length < 2) return [];

  const header = lines[0].split(',').map(h => h.trim());
  const correctIndex = header.indexOf('correct');
  const wrongIndex = header.indexOf('wrong');
  const explanationIndex = header.indexOf('explanation');

  if (correctIndex === -1 || wrongIndex === -1 || explanationIndex === -1) {
      console.error("CSV must have 'correct', 'wrong', and 'explanation' columns.");
      return [];
  }

  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    // Basic CSV parsing: doesn't handle commas within quoted fields.
    const values = lines[i].split(',');
    if (values.length < 3) continue;

    const correct = values[correctIndex].trim();
    // The 'wrong' column might have multiple comma-separated values, join them back
    const wrong = values[wrongIndex].trim().split(';').map(w => w.trim())[0]; // Take the first wrong answer if multiple
    const explanation = values.slice(explanationIndex).join(',').trim().replace(/^"|"$/g, '');

    if (correct && wrong) {
        rows.push({ correct, wrong, explanation });
    }
  }
  return rows;
}

function shuffle<T>(array: T[]): T[] {
    // Use a copy to avoid modifying the original array
    const newArray = [...array];
    for (let i = newArray.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
    }
    return newArray;
}

let cachedQuestions: Question[] | null = null;

export async function getQuestions(): Promise<Question[]> {
  if (cachedQuestions) {
    return shuffle(cachedQuestions);
  }

  const filePath = path.join(process.cwd(), 'src', 'lib', 'kelimeler.csv');
  try {
    const fileContent = await fs.readFile(filePath, 'utf-8');
    const parsedData = parseCSV(fileContent);

    const questions: Question[] = parsedData.map(row => {
      const isCorrectFirst = Math.random() > 0.5;
      return {
        options: isCorrectFirst ? [row.correct, row.wrong] : [row.wrong, row.correct],
        correctAnswer: isCorrectFirst ? 0 : 1,
        explanation: row.explanation,
      };
    });

    cachedQuestions = questions;
    return shuffle(questions);
  } catch (error) {
    console.error("CSV dosyasını okuma veya işleme hatası:", error);
    return [];
  }
}
