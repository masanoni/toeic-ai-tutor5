import React, { useState, useCallback } from 'react';
import { GrammarQuizQuestion, Level } from '../types';
import { GRAMMAR_TOPICS, LEVELS } from '../constants';
import { generateGrammarExplanation, generateGrammarQuiz } from '../services/geminiService';
import LoadingSpinner from '../components/LoadingSpinner';

interface BasicGrammarModeProps {
  onGoHome: () => void;
}

type Phase = 'selecting' | 'learning' | 'quizzing' | 'results';

const BasicGrammarMode: React.FC<BasicGrammarModeProps> = ({ onGoHome }) => {
  const [phase, setPhase] = useState<Phase>('selecting');
  
  // State for topic selection
  const [selectedTopics, setSelectedTopics] = useState<Set<string>>(new Set());
  const [practiceLevel, setPracticeLevel] = useState<Level>(Level.Beginner);

  // State for the "learn -> quiz" flow
  const [learningTopic, setLearningTopic] = useState<string | null>(null);
  const [explanation, setExplanation] = useState<string | null>(null);

  // Quiz state
  const [quiz, setQuiz] = useState<GrammarQuizQuestion[] | null>(null);
  const [currentQuizIndex, setCurrentQuizIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState<(number | null)[]>([]);
  
  // General state
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // --- Topic Selection Handlers ---

  const handleTopicCheckboxChange = (topic: string) => {
    setSelectedTopics(prev => {
      const newSet = new Set(prev);
      if (newSet.has(topic)) {
        newSet.delete(topic);
      } else {
        newSet.add(topic);
      }
      return newSet;
    });
  };

  const handleSelectAllChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedTopics(new Set(GRAMMAR_TOPICS));
    } else {
      setSelectedTopics(new Set());
    }
  };

  // --- Flow Control Handlers ---

  const handleStartLearning = useCallback(async () => {
    if (selectedTopics.size !== 1) return;
    const topic = Array.from(selectedTopics)[0];
    
    setLearningTopic(topic);
    setPhase('learning');
    setIsLoading(true);
    setError(null);
    setExplanation(null);
    setQuiz(null);

    try {
      const result = await generateGrammarExplanation(topic);
      if (!result) throw new Error("AIから解説を取得できませんでした。");
      setExplanation(result);
    } catch (e: any) {
      setError(e.message || "解説の生成中にエラーが発生しました。");
    } finally {
      setIsLoading(false);
    }
  }, [selectedTopics]);

  const handleStartPracticeQuiz = useCallback(async () => {
    if (selectedTopics.size === 0) return;
    const topicsToQuiz = Array.from(selectedTopics);
    
    setLearningTopic(null); // This signifies a practice quiz
    setPhase('quizzing');
    setIsLoading(true);
    setError(null);
    setQuiz(null);
    
    try {
      const result = await generateGrammarQuiz(topicsToQuiz, undefined, practiceLevel);
      if (!result || result.length === 0) throw new Error("AIからクイズを取得できませんでした。");
      setQuiz(result);
      setUserAnswers(new Array(result.length).fill(null));
      setCurrentQuizIndex(0);
    } catch (e: any) {
      setError(e.message || "クイズの生成中にエラーが発生しました。");
    } finally {
      setIsLoading(false);
    }
  }, [selectedTopics, practiceLevel]);

  const handleStartQuizAfterLearning = useCallback(async () => {
    if (!learningTopic || !explanation) return;

    setPhase('quizzing');
    setIsLoading(true);
    setError(null);
    
    try {
      const result = await generateGrammarQuiz([learningTopic], explanation);
      if (!result || result.length === 0) throw new Error("AIからクイズを取得できませんでした。");
      setQuiz(result);
      setUserAnswers(new Array(result.length).fill(null));
      setCurrentQuizIndex(0);
    } catch (e: any) {
      setError(e.message || "クイズの生成中にエラーが発生しました。");
    } finally {
      setIsLoading(false);
    }
  }, [learningTopic, explanation]);


  const handleAnswerQuiz = (answerIndex: number) => {
    if (quiz === null || userAnswers[currentQuizIndex] !== null) return;
    const newAnswers = [...userAnswers];
    newAnswers[currentQuizIndex] = answerIndex;
    setUserAnswers(newAnswers);
  };

  const handleNextQuestion = () => {
    if (quiz === null) return;
    if (currentQuizIndex < quiz.length - 1) {
        setCurrentQuizIndex(prev => prev + 1);
    } else {
        setPhase('results');
    }
  };

  const handleReset = () => {
    setPhase('selecting');
    setSelectedTopics(new Set());
    setLearningTopic(null);
    setExplanation(null);
    setQuiz(null);
    setCurrentQuizIndex(0);
    setUserAnswers([]);
    setError(null);
  };
  
  const handleRedoLearning = () => {
      if (!learningTopic) {
          handleReset();
          return;
      }
      // Re-trigger the learning flow for the specific topic
      setSelectedTopics(new Set([learningTopic]));
      handleStartLearning();
  };

  // --- Render Functions ---

  const renderTopicSelection = () => (
    <div className="bg-white p-6 md:p-8 rounded-2xl shadow-xl">
      <h2 className="text-2xl font-bold text-center text-slate-800 mb-2">学習方法を選択してください</h2>
      <p className="text-center text-slate-600 mb-6">解説を読んでからクイズに挑戦するか、複数のトピックを選んで練習クイズに挑戦できます。</p>
      
      <div className="border rounded-lg p-4 max-h-[40vh] overflow-y-auto mb-6">
        <div className="flex items-center justify-between border-b pb-2 mb-2">
            <label htmlFor="select-all" className="font-semibold text-slate-700">文法トピック</label>
            <div className="flex items-center gap-2">
                <label htmlFor="select-all" className="text-sm text-slate-600">全て選択</label>
                <input
                    type="checkbox"
                    id="select-all"
                    checked={selectedTopics.size === GRAMMAR_TOPICS.length && GRAMMAR_TOPICS.length > 0}
                    onChange={handleSelectAllChange}
                    className="h-5 w-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
            </div>
        </div>
        <div className="space-y-2">
            {GRAMMAR_TOPICS.map((topic) => (
                <label key={topic} htmlFor={`topic-${topic}`} className="flex items-center p-2 rounded-md hover:bg-slate-100 cursor-pointer">
                    <input
                        type="checkbox"
                        id={`topic-${topic}`}
                        checked={selectedTopics.has(topic)}
                        onChange={() => handleTopicCheckboxChange(topic)}
                        className="h-5 w-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="ml-3 text-slate-800">{topic}</span>
                </label>
            ))}
        </div>
      </div>

      <div className="mb-6 p-4 border rounded-lg bg-slate-50">
        <label htmlFor="practice-level-select" className="block text-lg font-medium text-slate-700 mb-2">
           練習クイズのレベル
        </label>
        <select
          id="practice-level-select"
          value={practiceLevel}
          onChange={(e) => setPracticeLevel(e.target.value as Level)}
          className="w-full p-3 border border-slate-300 rounded-lg bg-white text-base focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
        >
          {LEVELS.map((level) => (
            <option key={level} value={level}>{level}</option>
          ))}
        </select>
        <p className="text-sm text-slate-500 mt-2">上記のレベルは「練習クイズを開始」ボタンに適用されます。<br/>解説を読むモードはトピックの基本を学習します。</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <button 
              onClick={handleStartLearning}
              disabled={selectedTopics.size !== 1}
              className="bg-blue-600 text-white font-bold py-3 px-6 rounded-lg hover:bg-blue-700 transition shadow-md disabled:bg-slate-400 disabled:cursor-not-allowed flex flex-col items-center justify-center text-center"
          >
              解説を読んでからクイズ
              <span className="text-xs font-normal opacity-80">(トピックを1つ選択)</span>
          </button>
          <button 
              onClick={handleStartPracticeQuiz}
              disabled={selectedTopics.size === 0}
              className="bg-rose-500 text-white font-bold py-3 px-6 rounded-lg hover:bg-rose-600 transition shadow-md disabled:bg-slate-400 disabled:cursor-not-allowed flex flex-col items-center justify-center text-center"
          >
              練習クイズを開始
              <span className="text-xs font-normal opacity-80">(50問 / 1つ以上選択)</span>
          </button>
      </div>
    </div>
  );

  const renderLearning = () => (
    <div className="bg-white p-6 md:p-8 rounded-2xl shadow-xl w-full">
      <h2 className="text-3xl font-bold text-slate-800 mb-4">{learningTopic}</h2>
      {isLoading && <LoadingSpinner />}
      {error && <p className="text-red-500 bg-red-100 p-4 rounded-lg">{error}</p>}
      {explanation && (
        <>
          <div className="max-h-[50vh] overflow-y-auto pr-4 mb-6">
            <p className="text-slate-700 whitespace-pre-wrap leading-relaxed">{explanation}</p>
          </div>
          <button onClick={handleStartQuizAfterLearning} className="w-full bg-green-600 text-white font-bold py-3 px-6 rounded-lg hover:bg-green-700 transition text-lg">
            理解度チェッククイズに進む
          </button>
        </>
      )}
    </div>
  );

  const renderQuiz = () => {
      const question = quiz?.[currentQuizIndex];
      const userAnswer = userAnswers[currentQuizIndex];
      if (!question) return <LoadingSpinner />;

      return (
        <div className="bg-white p-6 md:p-8 rounded-2xl shadow-xl w-full">
            <p className="text-sm text-slate-500 mb-2 text-right">Question {currentQuizIndex + 1} / {quiz?.length}</p>
            <h3 className="text-lg font-semibold text-slate-700 mb-2">{question.question_jp}</h3>
            <p className="text-xl font-medium text-slate-800 mb-6 bg-slate-100 p-4 rounded-md">{question.sentence_with_blank}</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {question.options.map((option, index) => {
                     const isSelected = userAnswer === index;
                     const isCorrect = question.correctOptionIndex === index;
                     let buttonClass = "w-full text-left p-4 rounded-lg border-2 transition-all duration-300 ";
                     if (userAnswer !== null) { // If answered
                        if (isSelected) buttonClass += isCorrect ? 'bg-green-100 border-green-500 text-green-900' : 'bg-red-100 border-red-500 text-red-900';
                        else if (isCorrect) buttonClass += 'bg-green-100 border-green-500';
                        else buttonClass += 'bg-slate-50 border-slate-200 text-slate-600';
                     } else { // Not answered yet
                        buttonClass += 'bg-white border-slate-300 hover:bg-blue-50 hover:border-blue-400';
                     }
                    return <button key={index} onClick={() => handleAnswerQuiz(index)} disabled={userAnswer !== null} className={buttonClass}>({String.fromCharCode(65 + index)}) {option}</button>;
                })}
            </div>
            {userAnswer !== null && (
                <>
                    <div className="w-full mt-6 p-4 rounded-lg bg-slate-50 border border-slate-200">
                        <p className="font-bold text-slate-700">解説:</p>
                        <p className="text-slate-700 whitespace-pre-wrap">{question.explanation_jp}</p>
                    </div>
                    <button 
                        onClick={handleNextQuestion}
                        className="w-full mt-4 bg-blue-600 text-white font-bold py-3 px-6 rounded-lg hover:bg-blue-700 transition"
                    >
                        {currentQuizIndex < (quiz?.length ?? 0) - 1 ? '次の問題へ' : '結果を見る'}
                    </button>
                 </>
            )}
        </div>
      );
  };
  
  const renderResults = () => {
      const correctCount = quiz?.filter((q, i) => q.correctOptionIndex === userAnswers[i]).length || 0;
      const totalCount = quiz?.length || 0;
      const isPracticeMode = !learningTopic;
      
      return (
        <div className="bg-white p-6 md:p-8 rounded-2xl shadow-xl w-full text-center">
            <h2 className="text-3xl font-bold text-slate-800 mb-4">クイズ結果</h2>
            <p className="text-5xl font-bold text-blue-600 my-6">{correctCount} / {totalCount}</p>
            <div className="flex flex-col sm:flex-row gap-4 mt-8">
                <button 
                    onClick={isPracticeMode ? handleStartPracticeQuiz : handleRedoLearning} 
                    className="flex-1 bg-slate-600 text-white font-bold py-3 px-6 rounded-lg hover:bg-slate-700 transition"
                >
                    {isPracticeMode ? '同じ設定で再度練習' : 'もう一度学習する'}
                </button>
                <button onClick={handleReset} className="flex-1 bg-blue-600 text-white font-bold py-3 px-6 rounded-lg hover:bg-blue-700 transition">別のトピックを選ぶ</button>
            </div>
        </div>
      );
  }

  const renderContent = () => {
    if (isLoading && phase !== 'quizzing' && phase !== 'learning') return <LoadingSpinner />;

    switch (phase) {
      case 'selecting': return renderTopicSelection();
      case 'learning': return renderLearning();
      case 'quizzing': return isLoading ? <LoadingSpinner /> : renderQuiz();
      case 'results': return renderResults();
      default: return <p>エラーが発生しました。</p>;
    }
  };

  return (
    <div className="w-full max-w-3xl mx-auto p-4">
        <div className="flex justify-between items-center mb-6">
            <button onClick={phase === 'selecting' ? onGoHome : handleReset} className="text-blue-600 hover:text-blue-800">
              &larr; {phase === 'selecting' ? 'Back to Home' : 'Back to Topics'}
            </button>
            <h1 className="text-2xl font-bold text-slate-800">基礎文法モード</h1>
            <div/>
        </div>
        {renderContent()}
    </div>
  );
};

export default BasicGrammarMode;