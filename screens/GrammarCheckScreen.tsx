
import React, { useState, useCallback } from 'react';
import { GrammarCheckResult } from '../types';
import { checkGrammar } from '../services/geminiService';
import LoadingSpinner from '../components/LoadingSpinner';
import SpellCheckIcon from '../components/icons/SpellCheckIcon';

interface GrammarCheckScreenProps {
  onGoHome: () => void;
}

const GrammarCheckScreen: React.FC<GrammarCheckScreenProps> = ({ onGoHome }) => {
  const [inputText, setInputText] = useState('');
  const [result, setResult] = useState<GrammarCheckResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCheckGrammar = useCallback(async () => {
    if (!inputText.trim()) {
      setError("Please enter a sentence to check.");
      return;
    }
    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      const checkResult = await checkGrammar(inputText);
      if (!checkResult) {
        throw new Error("AI failed to return a valid response. Please try again.");
      }
      setResult(checkResult);
    } catch (e: any) {
      setError(e.message || "An unexpected error occurred.");
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  }, [inputText]);

  const handleReset = () => {
    setInputText('');
    setResult(null);
    setError(null);
    setIsLoading(false);
  };

  const isCorrect = result && result.originalSentence === result.correctedSentence;

  return (
    <div className="w-full max-w-3xl mx-auto p-4">
      <div className="flex justify-between items-center mb-6">
        <button onClick={onGoHome} className="text-blue-600 hover:text-blue-800">&larr; Back to Home</button>
        <h1 className="text-2xl font-bold text-slate-800">AI Grammar Check</h1>
        <div/>
      </div>

      <div className="bg-white p-6 md:p-8 rounded-2xl shadow-xl">
        <h2 className="text-xl font-semibold text-slate-700 mb-3">Enter an English sentence</h2>
        <textarea
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder="e.g., He don't like apple."
          className="w-full h-32 p-4 border border-slate-300 rounded-lg bg-slate-50 text-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
          disabled={isLoading}
        />
        <div className="flex flex-col sm:flex-row gap-4 mt-4">
          <button
            onClick={handleCheckGrammar}
            disabled={isLoading || !inputText.trim()}
            className="flex-grow bg-blue-600 text-white font-bold py-3 px-6 rounded-lg text-lg hover:bg-blue-700 transition shadow-md disabled:bg-slate-400 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isLoading ? <LoadingSpinner /> : <><SpellCheckIcon className="w-6 h-6" /> Check Grammar</>}
          </button>
          <button
              onClick={handleReset}
              disabled={isLoading}
              className="flex-grow bg-slate-200 text-slate-700 font-bold py-3 px-6 rounded-lg text-lg hover:bg-slate-300 transition shadow-sm disabled:bg-slate-300"
            >
              Clear
            </button>
        </div>
        
        {error && <p className="mt-4 text-center text-red-500 bg-red-100 p-3 rounded-lg">{error}</p>}
        
        {result && (
          <div className="mt-8 border-t border-slate-200 pt-6 space-y-4">
              <div>
                  <h3 className="text-sm font-semibold text-slate-500 mb-1">Original Sentence</h3>
                  <p className="p-3 bg-slate-100 rounded-md text-slate-700">{result.originalSentence}</p>
              </div>
               <div>
                  <h3 className={`text-sm font-semibold mb-1 ${isCorrect ? 'text-green-600' : 'text-orange-600'}`}>
                    {isCorrect ? 'Correct Sentence' : 'Corrected Sentence'}
                  </h3>
                  <p className={`p-3 rounded-md ${isCorrect ? 'bg-green-100 text-green-800' : 'bg-orange-100 text-orange-800'}`}>{result.correctedSentence}</p>
              </div>
               <div>
                  <h3 className="text-sm font-semibold text-slate-500 mb-1">AIの解説 (Explanation)</h3>
                  <div className="p-3 bg-blue-50 rounded-md text-blue-900 border border-blue-200 whitespace-pre-wrap leading-relaxed">
                      {result.explanation_jp}
                  </div>
              </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default GrammarCheckScreen;
