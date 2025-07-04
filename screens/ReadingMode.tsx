import React, { useState, useEffect, useCallback } from 'react';
import { Level, VocabCategory, ReadingPassage } from '../types';
import { generateReadingPassage } from '../services/geminiService';
import LoadingSpinner from '../components/LoadingSpinner';
import IdiomsModal from '../components/IdiomsModal';
import { LEVELS, VOCAB_CATEGORIES } from '../constants';

interface ReadingModeProps {
  onGoHome: () => void;
  initialCategory: VocabCategory | 'Random';
  level: Level;
}

const ReadingMode: React.FC<ReadingModeProps> = ({ onGoHome, initialCategory, level }) => {
  const [passageData, setPassageData] = useState<ReadingPassage | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [currentLevel, setCurrentLevel] = useState<Level>(level);
  const [answers, setAnswers] = useState<(number | null)[]>([]);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isIdiomsModalOpen, setIsIdiomsModalOpen] = useState(false);
  const [showTranslation, setShowTranslation] = useState(false);

  const fetchPassage = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    setPassageData(null);
    setAnswers([]);
    setIsSubmitted(false);
    setShowTranslation(false);
    try {
      const categoryToFetch = initialCategory === 'Random'
        ? VOCAB_CATEGORIES[Math.floor(Math.random() * VOCAB_CATEGORIES.length)]
        : initialCategory;

      const data = await generateReadingPassage(currentLevel, categoryToFetch);
      if (!data || !data.questions || data.questions.length === 0) {
        setError("Could not generate a reading passage with questions. Please try again.");
      } else {
        setPassageData(data);
        setAnswers(new Array(data.questions.length).fill(null));
      }
    } catch (e) {
      setError("An error occurred while fetching the passage.");
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  }, [currentLevel, initialCategory]);

  useEffect(() => {
    fetchPassage();
  }, [fetchPassage]);

  const handleSelectAnswer = (questionIndex: number, answerIndex: number) => {
    if (isSubmitted) return;
    const newAnswers = [...answers];
    newAnswers[questionIndex] = answerIndex;
    setAnswers(newAnswers);
  };

  const handleSubmit = () => {
    setIsSubmitted(true);
  };

  const handleTryAgain = () => {
    fetchPassage();
  };

  const renderContent = () => {
    if (isLoading) return <LoadingSpinner />;
    if (error) return <p className="text-center text-red-500 bg-red-100 p-4 rounded-lg">{error}</p>;
    if (!passageData) return <p className="text-center text-slate-500">No passage loaded.</p>;

    const allQuestionsAnswered = answers.every(a => a !== null);
    const correctCount = answers.filter((ans, i) => ans === passageData.questions[i].correctOptionIndex).length;

    return (
      <div className="w-full">
        <div className="flex flex-col md:flex-row gap-8">
          {/* Left Column: Passage */}
          <div className="md:w-1/2 lg:w-3/5">
            <div className="bg-white p-6 rounded-2xl shadow-xl sticky top-4">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-bold">Reading Passage</h2>
                {isSubmitted && (
                   <button onClick={() => setShowTranslation(prev => !prev)} className="bg-cyan-600 text-white font-bold py-2 px-3 rounded-lg hover:bg-cyan-700 transition text-sm">
                      {showTranslation ? '日本語訳を隠す' : '日本語訳を表示'}
                   </button>
                )}
              </div>
              <div className="space-y-4 text-base leading-relaxed max-h-[65vh] overflow-y-auto pr-2">
                {passageData.passage.map((sentence, index) => (
                  <div key={index} className="pb-2">
                    <p className="text-slate-800 font-medium leading-relaxed">{sentence.english}</p>
                    {showTranslation && (
                      <p className="text-slate-500 mt-1 leading-relaxed">{sentence.japanese}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right Column: Questions */}
          <div className="md:w-1/2 lg:w-2/5">
            <div className="bg-white p-6 rounded-2xl shadow-xl">
              <h2 className="text-2xl font-bold mb-4">Questions</h2>
              <div className="space-y-6">
                {passageData.questions.map((question, qIndex) => {
                  const selectedAnswer = answers[qIndex];
                  return (
                    <div key={qIndex} className="border-t border-slate-200 pt-4 first:border-t-0 first:pt-0">
                      <p className="font-semibold text-slate-800 mb-3">
                        {qIndex + 1}. {question.question}
                      </p>
                      <div className="space-y-2">
                        {question.options.map((option, oIndex) => {
                          const isSelected = selectedAnswer === oIndex;
                          const isCorrect = question.correctOptionIndex === oIndex;
                          let buttonClass = "w-full text-left p-3 rounded-lg border-2 transition text-sm ";

                          if (isSubmitted) {
                            if (isSelected) {
                              buttonClass += isCorrect ? 'bg-green-100 border-green-500 text-green-900 font-bold' : 'bg-red-100 border-red-500 text-red-900 font-bold';
                            } else if (isCorrect) {
                              buttonClass += 'bg-green-100 border-green-500';
                            } else {
                              buttonClass += 'bg-slate-50 border-slate-200 text-slate-600';
                            }
                          } else {
                            buttonClass += isSelected ? 'bg-blue-100 border-blue-500' : 'bg-white border-slate-300 hover:bg-blue-50 hover:border-blue-400';
                          }
                          return (
                            <button key={oIndex} onClick={() => handleSelectAnswer(qIndex, oIndex)} disabled={isSubmitted} className={buttonClass}>
                              ({String.fromCharCode(65 + oIndex)}) {option}
                            </button>
                          );
                        })}
                      </div>
                      {isSubmitted && (
                        <div className="mt-3 p-3 rounded-lg bg-slate-50 text-sm">
                          <p className="font-bold text-slate-700">Explanation:</p>
                          <p className="text-slate-600">{question.explanation}</p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="mt-8 pt-6 border-t border-slate-200">
                {isSubmitted ? (
                   <div className="text-center space-y-4">
                        <p className="text-xl font-bold">Score: {correctCount} / {passageData.questions.length}</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <button onClick={() => setIsIdiomsModalOpen(true)} className="bg-purple-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-purple-700 transition">
                                重要単語・熟語
                            </button>
                            <button onClick={handleTryAgain} className="bg-slate-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-slate-700 transition">
                                新しい問題に挑戦
                            </button>
                        </div>
                   </div>
                ) : (
                  <button onClick={handleSubmit} disabled={!allQuestionsAnswered} className="w-full bg-green-600 text-white font-bold py-3 px-6 rounded-lg hover:bg-green-700 transition disabled:bg-slate-400 disabled:cursor-not-allowed">
                    {allQuestionsAnswered ? 'Check Answers' : 'Please answer all questions'}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };


  return (
    <div className="w-full max-w-7xl mx-auto p-4">
      {passageData && <IdiomsModal idioms={passageData.idioms} isOpen={isIdiomsModalOpen} onClose={() => setIsIdiomsModalOpen(false)} />}
      <div className="flex justify-between items-center mb-6">
        <button onClick={onGoHome} className="text-blue-600 hover:text-blue-800">&larr; Back to Home</button>
        <h1 className="text-2xl font-bold text-slate-800">Part 7: Reading Comprehension</h1>
        <div/>
      </div>
      <p className="text-center text-slate-600 -mt-4 mb-6">AIが生成した長文読解問題（パート7形式）です。</p>
      
      <div className="mb-6 p-4 bg-white rounded-lg shadow-md flex flex-col sm:flex-row flex-wrap gap-4 justify-center items-center">
        <div className="flex items-center gap-2">
            <label className="font-semibold text-slate-600">Level:</label>
            <select value={currentLevel} onChange={e => setCurrentLevel(e.target.value as Level)} className="p-2 border rounded-md bg-white text-slate-800 focus:ring-2 focus:ring-blue-500" disabled={isLoading}>
                {LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
            </select>
        </div>
        <button onClick={fetchPassage} className="bg-blue-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-blue-700 transition" disabled={isLoading}>
            {isLoading ? 'Generating...' : 'New Passage'}
        </button>
      </div>

      {renderContent()}
    </div>
  );
};

export default ReadingMode;