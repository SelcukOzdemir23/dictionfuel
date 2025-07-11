"use client";

import { useReducer, useEffect, useMemo, useRef, useState } from 'react';
import type { Question } from '@/lib/questions';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Trophy, CheckCircle2, XCircle, SpellCheck, Play, User, ListOrdered, Clock, Star, Flame } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import Confetti from 'react-confetti';

// --- State, Reducer and Actions ---

type GameState = 'welcome' | 'playing' | 'finished';

type ScoreRecord = {
    name: string;
    score: number;
    date: string;
};

type State = {
    gameState: GameState;
    playerName: string;
    allQuestions: Question[];
    questions: Question[];
    currentQuestionIndex: number;
    score: number;
    streak: number; // New: for consecutive correct answers
    selectedAnswer: number | null;
    isAnswered: boolean;
    timeLeft: number;
    highScores: ScoreRecord[];
    lastToastTimestamp: number; // New: to prevent toast spam
};

type Action =
    | { type: 'START_GAME'; payload: { playerName: string; questions: Question[] } }
    | { type: 'ANSWER_QUESTION'; payload: { answerIndex: number | null } }
    | { type: 'NEXT_QUESTION' }
    | { type: 'FINISH_GAME' }
    | { type: 'PLAY_AGAIN' }
    | { type: 'TICK_TIMER' }
    | { type: 'GO_TO_WELCOME' }
    | { type: 'SET_HIGH_SCORES'; payload: ScoreRecord[] }
    | { type: 'UPDATE_PLAYER_NAME'; payload: string }
    | { type: 'SHOW_TOAST' };

const QUESTIONS_PER_ROUND = 10;
const TIME_PER_QUESTION = 15;
const STREAK_BONUS_THRESHOLD = 3;
const STREAK_BONUS_POINTS = 5;

const initialState: Omit<State, 'allQuestions'> = {
    gameState: 'welcome',
    playerName: '',
    questions: [],
    currentQuestionIndex: 0,
    score: 0,
    streak: 0,
    selectedAnswer: null,
    isAnswered: false,
    timeLeft: TIME_PER_QUESTION,
    highScores: [],
    lastToastTimestamp: 0,
};

function shuffle<T>(array: T[]): T[] {
    const newArray = [...array];
    for (let i = newArray.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
    }
    return newArray;
}

function gameReducer(state: State, action: Action): State {
    switch (action.type) {
        case 'UPDATE_PLAYER_NAME':
            return { ...state, playerName: action.payload };

        case 'START_GAME':
            return {
                ...state,
                playerName: action.payload.playerName,
                questions: action.payload.questions,
                gameState: 'playing',
                currentQuestionIndex: 0,
                score: 0,
                streak: 0,
                selectedAnswer: null,
                isAnswered: false,
                timeLeft: TIME_PER_QUESTION,
            };

        case 'ANSWER_QUESTION': {
            if (state.isAnswered) return state;

            const currentQuestion = state.questions[state.currentQuestionIndex];
            const isCorrect = action.payload.answerIndex === currentQuestion.correctAnswer;
            
            let newScore = state.score;
            let newStreak = state.streak;
            
            if (isCorrect) {
                const timeBonus = state.timeLeft;
                const streakBonus = newStreak >= STREAK_BONUS_THRESHOLD ? STREAK_BONUS_POINTS * (newStreak - STREAK_BONUS_THRESHOLD + 1) : 0;
                newScore += 10 + timeBonus + streakBonus;
                newStreak += 1;
            } else {
                newStreak = 0; // Reset streak on wrong answer
            }
            
            return {
                ...state,
                isAnswered: true,
                selectedAnswer: action.payload.answerIndex,
                score: newScore,
                streak: newStreak,
            };
        }

        case 'NEXT_QUESTION': {
            if (state.currentQuestionIndex < state.questions.length - 1) {
                return {
                    ...state,
                    currentQuestionIndex: state.currentQuestionIndex + 1,
                    isAnswered: false,
                    selectedAnswer: null,
                    timeLeft: TIME_PER_QUESTION,
                };
            }
            return { ...state, gameState: 'finished' };
        }
        
        case 'FINISH_GAME':
            return { ...state, gameState: 'finished' };

        case 'PLAY_AGAIN': {
            const roundQuestions = shuffle(state.allQuestions).slice(0, QUESTIONS_PER_ROUND);
            return {
                ...initialState,
                allQuestions: state.allQuestions,
                highScores: state.highScores,
                playerName: state.playerName,
                gameState: 'playing',
                questions: roundQuestions,
            };
        }

        case 'GO_TO_WELCOME':
            return {
                ...initialState,
                allQuestions: state.allQuestions,
                highScores: getHighScores(),
                playerName: ''
            };

        case 'TICK_TIMER':
            if (state.timeLeft <= 1) {
                return gameReducer(state, { type: 'ANSWER_QUESTION', payload: { answerIndex: null } });
            }
            return { ...state, timeLeft: state.timeLeft - 1 };
        
        case 'SET_HIGH_SCORES':
            return { ...state, highScores: action.payload };

        case 'SHOW_TOAST':
            return { ...state, lastToastTimestamp: Date.now() };

        default:
            return state;
    }
}

// --- LocalStorage Utilities ---

const getHighScores = (): ScoreRecord[] => {
    if (typeof window === 'undefined') return [];
    try {
        const scoresJson = localStorage.getItem('highScores');
        return scoresJson ? JSON.parse(scoresJson) : [];
    } catch (e) {
        return [];
    }
};

const saveHighScore = (name: string, score: number) => {
    if (typeof window === 'undefined') return;
    const highScores = getHighScores();
    const newScore: ScoreRecord = { name, score, date: new Date().toLocaleDateString('tr-TR') };
    highScores.push(newScore);
    highScores.sort((a, b) => b.score - a.score);
    localStorage.setItem('highScores', JSON.stringify(highScores.slice(0, 5)));
};

// --- Component ---

type GameContainerProps = {
  allQuestions: Question[];
};

export default function GameContainer({ allQuestions }: GameContainerProps) {
  const [state, dispatch] = useReducer(gameReducer, { ...initialState, allQuestions });
  const { toast } = useToast();
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });


  const {
      gameState,
      playerName,
      questions,
      currentQuestionIndex,
      score,
      streak,
      selectedAnswer,
      isAnswered,
      timeLeft,
      highScores,
      lastToastTimestamp,
  } = state;

  const currentQuestion = useMemo(() => questions[currentQuestionIndex], [questions, currentQuestionIndex]);

  // Effect for Sizing Confetti
  useEffect(() => {
    if (containerRef.current) {
        setContainerSize({
            width: containerRef.current.clientWidth,
            height: containerRef.current.clientHeight,
        })
    }
  }, [containerRef]);

  // Effect for Timer
  useEffect(() => {
    if (gameState !== 'playing' || isAnswered) return;
    const timer = setInterval(() => dispatch({ type: 'TICK_TIMER' }), 1000);
    return () => clearInterval(timer);
  }, [gameState, isAnswered]);

  // Effect for High Scores
  useEffect(() => {
    dispatch({ type: 'SET_HIGH_SCORES', payload: getHighScores() });
  }, [gameState]);
  
  // Save high score when game finishes
  useEffect(() => {
    if (gameState === 'finished') {
      saveHighScore(playerName, score);
      dispatch({ type: 'SET_HIGH_SCORES', payload: getHighScores() });
    }
  }, [gameState, playerName, score]);

  // Effect for Toasts
  useEffect(() => {
    if (!isAnswered || Date.now() - lastToastTimestamp < 2000 || !currentQuestion) return;

    const isCorrect = selectedAnswer === currentQuestion.correctAnswer;
    if (isCorrect) {
        let toastMessage = "Harika, doğru bildin!";
        if(streak > 1) toastMessage += ` ${streak}x Seri!`;
        const streakBonus = streak >= STREAK_BONUS_THRESHOLD ? STREAK_BONUS_POINTS * (streak - STREAK_BONUS_THRESHOLD + 1) : 0;
        const totalPoints = 10 + timeLeft + streakBonus;

        toast({
            title: toastMessage,
            description: `+${totalPoints} Puan`,
            variant: "default",
        });
    } else {
        toast({
            title: "Yanlış Cevap!",
            description: "Serin bozuldu, pes etme!",
            variant: "destructive",
        });
    }
    dispatch({ type: 'SHOW_TOAST' });

  }, [isAnswered, selectedAnswer, currentQuestion, streak, timeLeft, lastToastTimestamp, toast]);

  
  // --- Event Handlers ---
  const handleStartGame = () => {
    if (playerName.trim()) {
      const roundQuestions = shuffle(allQuestions).slice(0, QUESTIONS_PER_ROUND);
      dispatch({ type: 'START_GAME', payload: { playerName, questions: roundQuestions } });
    }
  };

  const handleNextQuestion = () => {
      if (currentQuestionIndex < questions.length - 1) {
          dispatch({ type: 'NEXT_QUESTION' });
      } else {
          dispatch({ type: 'FINISH_GAME' });
      }
  };

  // --- Render Logic ---
  const isHighScore = score > 0 && (highScores.length < 5 || score > highScores[highScores.length - 1].score);

  if (allQuestions.length === 0) {
    return (
      <Card className="w-full max-w-xl text-center shadow-2xl bg-card/80 backdrop-blur-sm animate-in fade-in zoom-in-95">
          <CardHeader>
              <CardTitle className="flex justify-center items-center gap-2 text-3xl">
                <XCircle className="text-destructive" size={32} />
                Sorular Yüklenemedi
              </CardTitle>
              <CardDescription>Bir hata oluştu. Lütfen daha sonra tekrar deneyin.</CardDescription>
          </CardHeader>
      </Card>
    );
  }

  if (gameState === 'welcome') {
    return (
        <div className="w-full max-w-xl flex flex-col gap-8 text-center animate-in fade-in-50 zoom-in-95">
             <header className="flex flex-col gap-4 items-center">
                <h1 className="text-6xl font-bold flex items-center gap-3">
                    <SpellCheck className="text-primary" size={56} />
                    DictionDuel
                </h1>
                <p className="text-lg text-muted-foreground">Yazım kurallarında ne kadar iyisin? Hadi kendini sına!</p>
            </header>
            <Card className="shadow-2xl bg-card/80 backdrop-blur-sm">
                <CardHeader>
                    <CardTitle className="flex justify-center items-center gap-2 text-2xl font-semibold">
                        <User className="text-primary" />
                        Oyuncu Adı
                    </CardTitle>
                     <CardDescription>Lütfen adını girerek oyuna başla.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex gap-2">
                         <Input 
                            type="text" 
                            placeholder="Adınız..." 
                            value={playerName} 
                            onChange={(e) => dispatch({ type: 'UPDATE_PLAYER_NAME', payload: e.target.value })}
                            onKeyDown={(e) => e.key === 'Enter' && handleStartGame()}
                            className="text-center text-lg h-12"
                         />
                    </div>
                </CardContent>
                <CardFooter>
                    <Button onClick={handleStartGame} disabled={!playerName.trim()} size="lg" className="w-full">
                        <Play className="mr-2" />
                        Oyuna Başla
                    </Button>
                </CardFooter>
            </Card>
        </div>
    );
  }


  if (gameState === 'finished') {
    return (
      <div ref={containerRef} className="w-full min-h-screen flex justify-center items-start pt-16">
        <Card className="w-full max-w-2xl text-center shadow-2xl bg-card/80 backdrop-blur-sm animate-in fade-in zoom-in-95">
          {isHighScore && (
            <Confetti
              width={containerSize.width}
              height={containerSize.height}
              recycle={false}
              numberOfPieces={400}
              tweenDuration={8000}
            />
          )}
          <CardHeader className="pb-2">
            <CardTitle className="text-3xl">
                {isHighScore ? "Yeni Yüksek Skor!" : `Tebrikler, ${playerName}!`}
            </CardTitle>
            <CardDescription>Düelloyu tamamladın.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
              <div className="relative">
                  <Trophy className="mx-auto h-24 w-24 text-primary opacity-20" />
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <p className="text-muted-foreground text-lg">Final Puanın</p>
                      <p className={cn("text-7xl font-bold text-primary", isHighScore && "animate-score-pop")}>
                          {score}
                      </p>
                  </div>
              </div>

          <div className="px-4">
              <h3 className="text-xl font-bold mb-4 flex items-center justify-center gap-2"><ListOrdered /> Yüksek Skorlar</h3>
              {highScores.length > 0 ? (
                  <ol className="space-y-2 text-left">
                      {highScores.map((entry, index) => (
                          <li key={index} className={cn(
                              "flex justify-between items-center p-3 rounded-lg bg-muted/50 transition-all",
                              entry.name === playerName && entry.score === score && "bg-primary/20 scale-105 border-2 border-primary"
                          )}>
                              <div className="flex items-center gap-3">
                                  <span className="font-bold text-lg w-6 text-center">{index + 1}.</span>
                                  <span className="font-semibold">{entry.name}</span>
                              </div>
                              <span className="text-primary font-bold text-lg">{entry.score} Puan</span>
                          </li>
                      ))}
                  </ol>
              ) : (
                  <p className="text-muted-foreground">Henüz kimse oynamamış. İlk rekoru sen kır!</p>
              )}
          </div>
          </CardContent>
          <CardFooter className="flex-col sm:flex-row gap-4 pt-6 border-t">
          <Button onClick={() => dispatch({ type: 'PLAY_AGAIN' })} size="lg" className="w-full sm:w-auto flex-1">
              Tekrar Oyna
          </Button>
          <Button onClick={() => dispatch({ type: 'GO_TO_WELCOME' })} size="lg" variant="ghost" className="w-full sm:w-auto flex-1">
              Ana Menü
          </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  const progressValue = questions.length > 0 ? ((currentQuestionIndex + 1) / questions.length) * 100 : 0;
  const timerColor = timeLeft <= 5 ? 'text-destructive' : 'text-accent';

  return (
    <div className="w-full max-w-2xl flex flex-col gap-8 animate-in fade-in-50 justify-center min-h-[70vh] mx-auto overflow-hidden">
        <header className="flex flex-col gap-4 items-center text-center">
            <div className="flex items-center justify-between gap-2 md:gap-4 w-full px-2">
                <Badge variant="outline" className="text-lg py-2 px-4 whitespace-nowrap border-primary text-primary">
                  {currentQuestionIndex + 1} / {questions.length}
                </Badge>

                {streak > 1 && (
                    <Badge variant="secondary" className="text-lg py-2 px-4 whitespace-nowrap bg-orange-500/20 text-orange-500 border border-orange-500/50">
                        <Flame className="mr-2 text-orange-400" /> {streak}x Seri
                    </Badge>
                )}
                
                <Badge variant="secondary" className="text-lg py-2 px-4 whitespace-nowrap">
                   <Star className="text-primary mr-2" /> {score}
                </Badge>
            </div>
             <Progress value={progressValue} className="h-3 w-full" />
        </header>

        <Card className="shadow-2xl bg-card/80 backdrop-blur-sm relative flex flex-col justify-center min-h-[420px] md:min-h-[60vh]">
            <div className="absolute top-4 right-4 flex items-center gap-2">
              <Badge variant="outline" className={cn("text-lg py-2 px-4 transition-colors", timerColor)}>
                <Clock className="mr-2" size={20} />
                {timeLeft}
              </Badge>
            </div>
            <CardHeader className="pt-12">
                <CardTitle className="text-4xl leading-snug text-center">
                    Hangisi doğru yazım?
                </CardTitle>
                <CardDescription className="text-center pt-2">
                    {playerName}, doğru seçeneğe tıkla!
                </CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {currentQuestion.options.map((option, index) => {
                    const isCorrect = index === currentQuestion.correctAnswer;
                    const isSelected = index === selectedAnswer;
                    
                    let buttonClass = "";
                    let Icon = null;

                    if(isAnswered) {
                        if(isCorrect) {
                           buttonClass = "bg-correct hover:bg-correct/90 text-correct-foreground animate-answer-reveal border-correct/90";
                           Icon = <CheckCircle2 />;
                        } else if (isSelected && !isCorrect) {
                            buttonClass = "bg-destructive hover:bg-destructive/90 text-destructive-foreground animate-answer-reveal";
                            Icon = <XCircle />;
                        } else {
                            buttonClass = "opacity-50";
                        }
                    }

                    return (
                        <Button
                            key={index}
                            onClick={() => dispatch({ type: 'ANSWER_QUESTION', payload: { answerIndex: index } })}
                            disabled={isAnswered}
                            variant="outline"
                            size="lg"
                            className={cn(
                                "justify-center text-center h-28 text-3xl font-bold whitespace-normal transition-all duration-300 transform hover:scale-105 relative",
                                buttonClass
                            )}
                        >
                           {Icon && <span className="absolute top-2 right-2">{Icon}</span>}
                           {option}
                        </Button>
                    );
                })}
            </CardContent>

            {isAnswered && (
                <CardFooter className="flex-col items-center text-center gap-4 border-t pt-6 animate-in fade-in-50 justify-center">
                    <p className="text-xl font-semibold">
                      {selectedAnswer === null ? "Süre doldu!" : selectedAnswer === currentQuestion.correctAnswer ? "Harika, doğru bildin!" : "Neredeyse! Doğrusu şuydu:"}
                    </p>
                    {(selectedAnswer !== currentQuestion.correctAnswer || selectedAnswer === null) &&
                      <p className="text-3xl font-bold text-primary">{currentQuestion.options[currentQuestion.correctAnswer]}</p>
                    }
                    <p className="text-muted-foreground text-center">{currentQuestion.explanation}</p>
                    <Button onClick={handleNextQuestion} className="w-full mt-2" size="lg">
                        {currentQuestionIndex < questions.length - 1 ? "Sıradaki Soru" : "Oyunu Bitir"}
                    </Button>
                </CardFooter>
            )}
        </Card>
    </div>
  );
}
