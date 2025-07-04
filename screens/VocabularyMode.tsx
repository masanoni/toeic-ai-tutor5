
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Level, VocabCategory, VocabDBItem, VocabType, PartOfSpeech, SortOrder } from '../types';
import { VOCAB_CATEGORIES, PARTS_OF_SPEECH } from '../constants';
import { getVocabulary } from '../db';
import { useTextToSpeech, SpeechCancellationError } from '../hooks/useTextToSpeech';
import LoadingSpinner from '../components/LoadingSpinner';
import SoundIcon from '../components/icons/SoundIcon';
import NextIcon from '../components/icons/NextIcon';

interface VocabularyModeProps {
  level: Level;
  onGoHome: () => void;
}

type StudyMode = 'listening' | 'writing' | 'en-jp-quiz' | 'jp-en-quiz';
type VocabSelection = VocabType | 'all';
type SessionSource = 'db' | 'file';

// Function to shuffle an array
const shuffleArray = <T,>(array: T[]): T[] => {
  const newArray = [...array];
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
};

const VocabularyMode: React.FC<VocabularyModeProps> = ({ level, onGoHome }) => {
  const [category, setCategory] = useState<VocabCategory>(VocabCategory.Business);
  const [vocabList, setVocabList] = useState<VocabDBItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [studyMode, setStudyMode] = useState<StudyMode>('listening');
  const [vocabSelection, setVocabSelection] = useState<VocabSelection>('word');
  const [userInput, setUserInput] = useState('');
  const [feedback, setFeedback] = useState<'correct' | 'incorrect' | 'idle'>('idle');
  const [posFilter, setPosFilter] = useState<PartOfSpeech | 'all'>('all');
  const [sortOrder, setSortOrder] = useState<SortOrder>('Random');
  const [frequencyLevel, setFrequencyLevel] = useState<number | undefined>();

  // Quiz states
  const [quizOptions, setQuizOptions] = useState<VocabDBItem[]>([]);
  const [selectedQuizAnswer, setSelectedQuizAnswer] = useState<VocabDBItem | null>(null);
  const [sessionLearnedIds, setSessionLearnedIds] = useState<Set<number>>(new Set());
  const [sessionReviewIds, setSessionReviewIds] = useState<Set<number>>(new Set());
  
  // New states for file-based review sessions
  const [sessionSource, setSessionSource] = useState<SessionSource>('db');
  const [loadedFileName, setLoadedFileName] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);


  const { speak, stop, isSpeaking } = useTextToSpeech();

  const currentItem = useMemo(() => vocabList[currentIndex], [vocabList, currentIndex]);

  const fetchVocabFromDB = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    setVocabList([]);
    setCurrentIndex(0);
    setUserInput('');
    setFeedback('idle');
    setQuizOptions([]);
    setSelectedQuizAnswer(null);

    try {
      const items = await getVocabulary(level, category, vocabSelection, posFilter, sortOrder, 30, frequencyLevel);
      if (items.length < 4 && (studyMode === 'en-jp-quiz' || studyMode === 'jp-en-quiz')) {
         setError("Not enough vocabulary for a quiz. Need at least 4 items. Try changing filters or adding more words.");
         setVocabList([]);
      } else if (items.length === 0) {
        setError("No vocabulary found for this selection. Try changing the category or filters, or wait for the database to populate more words.");
        setVocabList([]);
      } else {
        setVocabList(items);
      }
    } catch (e) {
      setError("An error occurred while fetching vocabulary from the local database.");
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  }, [level, category, vocabSelection, posFilter, sortOrder, studyMode, frequencyLevel]);

  useEffect(() => {
    // Only fetch from DB if we are in 'db' mode.
    // This will also trigger when switching back from 'file' mode.
    if (sessionSource === 'db') {
      fetchVocabFromDB();
    }
  }, [fetchVocabFromDB, sessionSource]);

  // Effect to set up quiz options
  useEffect(() => {
    if ((studyMode === 'en-jp-quiz' || studyMode === 'jp-en-quiz') && currentItem && vocabList.length >= 4) {
        const distractors = vocabList.filter(item => item.id !== currentItem.id);
        const shuffledDistractors = shuffleArray(distractors).slice(0, 3);
        const options = shuffleArray([currentItem, ...shuffledDistractors]);
        setQuizOptions(options);
    }
    setSelectedQuizAnswer(null);
    setFeedback('idle');
  }, [currentIndex, currentItem, studyMode, vocabList]);

  const handleNext = useCallback(() => {
    stop();
    if (sessionSource === 'file') {
      if (vocabList.length > 0) {
        setCurrentIndex(prev => (prev + 1) % vocabList.length); // Loop the list
      }
    } else {
      if (currentIndex < vocabList.length - 1) {
        setCurrentIndex(prev => prev + 1);
      } else {
        // End of batch, fetch a new one
        fetchVocabFromDB();
      }
    }
    setUserInput('');
    setFeedback('idle');
  }, [currentIndex, vocabList.length, fetchVocabFromDB, stop, sessionSource]);
  
  const playSequence = useCallback(async () => {
      if (!currentItem) return;
      try {
        await speak(currentItem.english, 'en-US');
        await new Promise(r => setTimeout(r, 500));
        await speak(currentItem.japanese, 'ja-JP');
        await new Promise(r => setTimeout(r, 500));
        await speak(currentItem.example_en, 'en-US');
        await new Promise(r => setTimeout(r, 500));
        await speak(currentItem.example_jp, 'ja-JP');
      } catch (error) {
        if (error instanceof SpeechCancellationError) {
          console.log('Speech sequence cancelled.');
        } else {
          console.error('Speech error:', error);
        }
      }
  }, [currentItem, speak]);

  const checkAnswer = async () => {
    if (!currentItem) return;
    const isCorrect = userInput.trim().toLowerCase() === currentItem.english.toLowerCase();
    setFeedback(isCorrect ? 'correct' : 'incorrect');
    if (isCorrect) {
        updateLearnedStatus(currentItem.id!, true);
        try { await speak("Correct!", 'en-US'); setTimeout(handleNext, 1500); } catch (e) { console.error(e); }
    } else {
        updateLearnedStatus(currentItem.id!, false);
        try { await speak("Try again.", 'en-US'); } catch (e) { console.error(e); }
    }
  };
  
  const handleWritingSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    checkAnswer();
  };

  const handleQuizAnswer = (selectedOption: VocabDBItem) => {
    if (feedback !== 'idle') return;
    setSelectedQuizAnswer(selectedOption);
    const isCorrect = selectedOption.id === currentItem.id;
    setFeedback(isCorrect ? 'correct' : 'incorrect');
    updateLearnedStatus(currentItem.id!, isCorrect);
  };
  
  const updateLearnedStatus = (id: number, learned: boolean) => {
    setSessionLearnedIds(prev => {
        const newSet = new Set(prev);
        if (learned) newSet.add(id);
        else newSet.delete(id);
        return newSet;
    });
     setSessionReviewIds(prev => {
        const newSet = new Set(prev);
        if (!learned) newSet.add(id);
        else newSet.delete(id);
        return newSet;
    });
  };
  
  const exportReviewList = () => {
    const reviewItems = vocabList.filter(item => sessionReviewIds.has(item.id!));
    if (reviewItems.length === 0) {
        alert("No items marked for review in this session.");
        return;
    }
    const dataStr = JSON.stringify({ vocabulary: reviewItems }, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    const exportFileDefaultName = 'toeic_review_list.json';
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  };

  const handleLoadReviewFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const text = e.target?.result;
        if (typeof text !== 'string') throw new Error("File could not be read");
        const data = JSON.parse(text);

        if (!data.vocabulary || !Array.isArray(data.vocabulary) || data.vocabulary.length === 0) {
          alert('Invalid JSON format or empty list. Expected an object with a non-empty "vocabulary" array.');
          return;
        }
        
        const firstItem = data.vocabulary[0];
        if (!firstItem.english || !firstItem.japanese || !firstItem.example_en) {
          alert('The items in the vocabulary list seem to be in the wrong format.');
          return;
        }
        
        stop();
        // Use a shuffled version of the list for variety each time it's loaded
        setVocabList(shuffleArray(data.vocabulary));
        setSessionSource('file');
        setLoadedFileName(file.name);
        setCurrentIndex(0);
        setUserInput('');
        setFeedback('idle');
        setError(null);
        setSessionLearnedIds(new Set());
        setSessionReviewIds(new Set());
      } catch (error) {
        console.error('Error importing review list:', error);
        alert('Failed to import review list. Please check the file format and console for errors.');
      } finally {
        if (event.target) event.target.value = '';
      }
    };
    reader.readAsText(file);
  };
  
  const handleReturnToStandardMode = () => {
    setSessionSource('db');
    setLoadedFileName(null);
    setVocabList([]); // Clear list immediately
    setIsLoading(true); // Show loading spinner while fetchVocabFromDB runs
  };

  const renderQuizContent = () => {
    if (!currentItem || quizOptions.length === 0) return <LoadingSpinner />;
    
    const isEnToJp = studyMode === 'en-jp-quiz';
    const questionText = isEnToJp ? currentItem.english : currentItem.japanese;
    const getOptionText = (item: VocabDBItem) => isEnToJp ? item.japanese : item.english;
    
    return (
      <div className="w-full bg-white p-6 rounded-2xl shadow-xl transition-all duration-500">
        <p className="text-right text-slate-500 mb-4">{currentIndex + 1} / {vocabList.length}</p>
        <div className="text-center">
            <p className="text-sm font-semibold text-slate-500 mb-2">{isEnToJp ? "What is the Japanese meaning of:" : "What is the English word/idiom for:"}</p>
            <h2 className="text-3xl font-bold mb-6">{questionText}</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {quizOptions.map((option) => {
            const isSelected = selectedQuizAnswer?.id === option.id;
            const isCorrect = option.id === currentItem.id;
            let buttonClass = "w-full text-left p-4 rounded-lg border-2 transition text-base ";
            
            if (feedback !== 'idle') {
              if (isCorrect) {
                buttonClass += 'bg-green-100 border-green-500 text-green-900 font-bold';
              } else if (isSelected) {
                buttonClass += 'bg-red-100 border-red-500 text-red-900 font-bold';
              } else {
                 buttonClass += 'bg-slate-50 border-slate-200 text-slate-600';
              }
            } else {
               buttonClass += 'bg-white border-slate-300 hover:bg-blue-50 hover:border-blue-400';
            }
            
            return (
              <button key={option.id} onClick={() => handleQuizAnswer(option)} className={buttonClass} disabled={feedback !== 'idle'}>
                {getOptionText(option)}
              </button>
            )
          })}
        </div>
        {feedback !== 'idle' && (
            <div className="mt-4 text-center p-4 rounded-lg bg-slate-50">
                <p className="text-lg font-bold">{currentItem.english}</p>
                <p className="text-md text-slate-600">{currentItem.japanese}</p>
                <div className="mt-3 flex justify-center gap-4">
                    <button onClick={() => updateLearnedStatus(currentItem.id!, true)} className={`px-3 py-1 text-sm rounded-full ${sessionLearnedIds.has(currentItem.id!) ? 'bg-green-600 text-white' : 'bg-green-200 text-green-800'}`}>I know this 👍</button>
                    <button onClick={() => updateLearnedStatus(currentItem.id!, false)} className={`px-3 py-1 text-sm rounded-full ${sessionReviewIds.has(currentItem.id!) ? 'bg-red-600 text-white' : 'bg-red-200 text-red-800'}`}>Needs review 👎</button>
                </div>
            </div>
        )}
      </div>
    );
  };

  const renderContent = () => {
    if (isLoading) return <LoadingSpinner />;
    if (error) return <div className="text-center p-8 bg-yellow-100 border border-yellow-300 rounded-lg">
        <p className="text-yellow-800 font-semibold">Heads up!</p>
        <p className="text-yellow-700 mt-2">{error}</p>
        <button onClick={onGoHome} className="mt-4 bg-blue-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-blue-700 transition">
            &larr; Back to Home
        </button>
    </div>;
    if (!currentItem) {
        if (sessionSource === 'file') {
            return (
                 <div className="text-center p-8 bg-blue-100 border border-blue-300 rounded-lg">
                    <p className="text-blue-800 font-semibold">Review list loaded!</p>
                    <p className="text-blue-700 mt-2">Ready to start your focused review session.</p>
                </div>
            );
        }
        return <p className="text-center text-slate-500">No vocabulary loaded.</p>;
    }
    
    if (studyMode === 'en-jp-quiz' || studyMode === 'jp-en-quiz') {
      return (
        <div className="w-full flex flex-col items-center">
          {renderQuizContent()}
           <button onClick={handleNext} className="mt-8 flex items-center gap-2 text-slate-600 font-semibold py-3 px-6 rounded-lg hover:bg-slate-200 transition">
            { sessionSource === 'file' ? 'Next Word' : 'Next Word/Batch' } <NextIcon />
          </button>
        </div>
      );
    }

    return (
      <div className="w-full flex flex-col items-center">
        <div className="w-full bg-white p-8 rounded-2xl shadow-xl transition-all duration-500">
            <div className="flex justify-between items-baseline mb-4">
                 <div className="flex gap-2 items-center">
                    <span className={`capitalize text-sm font-semibold py-1 px-3 rounded-full ${currentItem.type === 'idiom' ? 'bg-purple-200 text-purple-800' : 'bg-green-200 text-green-800'}`}>{currentItem.type}</span>
                    {currentItem.pos && (
                        <span className="capitalize text-sm font-semibold py-1 px-3 rounded-full bg-blue-200 text-blue-800">{currentItem.pos.toLowerCase()}</span>
                    )}
                </div>
                 <p className="text-center text-slate-500">{currentIndex + 1} / {vocabList.length}</p>
                 <div/>
            </div>
           
            {studyMode === 'listening' ? (
                <div className="text-center">
                    <h2 className="text-4xl font-bold mb-2">{currentItem.english}</h2>
                    <p className="text-2xl text-slate-600 mb-6">{currentItem.japanese}</p>
                    <p className="text-xl text-slate-800 mb-2">"{currentItem.example_en}"</p>
                    <p className="text-lg text-slate-500 mb-8">{currentItem.example_jp}</p>
                    <button onClick={() => playSequence()} disabled={isSpeaking} className="bg-blue-500 text-white rounded-full p-4 hover:bg-blue-600 transition disabled:bg-slate-300">
                        <SoundIcon className="w-8 h-8"/>
                    </button>
                </div>
            ) : (
                <div className="text-center">
                    <p className="text-2xl text-slate-600 mb-4">{currentItem.japanese}</p>
                    <p className="text-lg text-slate-500 mb-6">{currentItem.example_jp}</p>
                     <button onClick={() => speak(currentItem.example_en, 'en-US').catch(error => { if (!(error instanceof SpeechCancellationError)) { console.error('Speech error:', error); } })} disabled={isSpeaking} className="mb-4 text-blue-500 hover:text-blue-700 flex items-center gap-2 mx-auto disabled:text-slate-400">
                        <SoundIcon className="w-5 h-5"/> Hear Example
                    </button>
                    <form onSubmit={handleWritingSubmit} className="flex flex-col items-center gap-4">
                        <input
                            type="text"
                            value={userInput}
                            onChange={(e) => setUserInput(e.target.value)}
                            className={`w-full max-w-md p-4 border-2 rounded-lg text-lg text-center transition ${
                                feedback === 'correct' ? 'border-green-500 bg-green-50' :
                                feedback === 'incorrect' ? 'border-red-500 bg-red-50' :
                                'border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500'
                            }`}
                            placeholder="Type the English word/idiom"
                        />
                         <button type="submit" className="bg-blue-600 text-white font-bold py-3 px-8 rounded-lg text-lg hover:bg-blue-700 transition">
                            Check
                        </button>
                    </form>
                    {feedback === 'incorrect' && (
                        <button onClick={() => setUserInput(currentItem.english)} className="mt-4 text-sm text-slate-500 hover:text-slate-700">Show Answer</button>
                    )}
                </div>
            )}
        </div>
        <button onClick={handleNext} className="mt-8 flex items-center gap-2 text-slate-600 font-semibold py-3 px-6 rounded-lg hover:bg-slate-200 transition">
           { sessionSource === 'file' ? 'Next Word' : 'Next Word/Batch' } <NextIcon />
        </button>
      </div>
    );
  }
  
  const ModeButton: React.FC<{ mode: StudyMode, children: React.ReactNode }> = ({ mode, children }) => (
      <button onClick={() => setStudyMode(mode)} className={`px-3 py-2 text-sm font-semibold rounded-lg transition ${studyMode === mode ? 'bg-blue-600 text-white shadow-md' : 'bg-slate-200 text-slate-700 hover:bg-slate-300'}`}>{children}</button>
  );

  return (
    <div className="w-full max-w-3xl mx-auto p-4">
        <div className="flex justify-between items-center mb-6">
            <button onClick={onGoHome} className="text-blue-600 hover:text-blue-800">&larr; Back to Home</button>
            <h1 className="text-2xl font-bold text-slate-800">Vocabulary Mode</h1>
            <div/>
        </div>

        <div className="mb-6 p-4 bg-white rounded-lg shadow-md flex flex-col gap-4">
            {sessionSource === 'file' && (
              <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-lg flex flex-col sm:flex-row justify-between items-center gap-2">
                <div className="text-sm text-indigo-800 text-center sm:text-left">
                    <p><strong>Review Session Active:</strong></p>
                    <p className="font-medium break-all">{loadedFileName}</p>
                </div>
                <button onClick={handleReturnToStandardMode} className="bg-indigo-500 text-white font-bold py-2 px-4 rounded-lg hover:bg-indigo-600 transition text-sm whitespace-nowrap">
                    &larr; Return to Standard Mode
                </button>
              </div>
            )}
            
            <fieldset disabled={sessionSource === 'file' || isLoading} className="flex flex-col gap-4">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                    <div className="flex flex-col gap-1">
                        <label className="text-sm font-semibold text-slate-600">Category:</label>
                        <select value={category} onChange={e => setCategory(e.target.value as VocabCategory)} className="p-2 border rounded-md bg-slate-50 w-full disabled:opacity-70 disabled:cursor-not-allowed">
                            {VOCAB_CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                        </select>
                    </div>
                    <div className="flex flex-col gap-1">
                        <label className="text-sm font-semibold text-slate-600">Practice:</label>
                        <select value={vocabSelection} onChange={e => setVocabSelection(e.target.value as VocabSelection)} className="p-2 border rounded-md bg-slate-50 w-full disabled:opacity-70 disabled:cursor-not-allowed">
                           <option value="word">Words</option>
                           <option value="idiom">Idioms</option>
                           <option value="all">All</option>
                        </select>
                    </div>
                    <div className="flex flex-col gap-1">
                        <label className="text-sm font-semibold text-slate-600">Order:</label>
                        <select value={sortOrder} onChange={e => setSortOrder(e.target.value as SortOrder)} className="p-2 border rounded-md bg-slate-50 w-full disabled:opacity-70 disabled:cursor-not-allowed">
                            <option value="Random">Random</option>
                            <option value="Alphabetical">Alphabetical</option>
                        </select>
                    </div>
                    {vocabSelection === 'word' && (
                        <div className="flex flex-col gap-1">
                            <label className="text-sm font-semibold text-slate-600">Part of Speech:</label>
                            <select value={posFilter} onChange={e => setPosFilter(e.target.value as PartOfSpeech | 'all')} className="p-2 border rounded-md bg-slate-50 w-full disabled:opacity-70 disabled:cursor-not-allowed">
                                <option value="all">All</option>
                                {PARTS_OF_SPEECH.map(pos => <option key={pos} value={pos}>{pos}</option>)}
                            </select>
                        </div>
                    )}
                    <div className="flex flex-col gap-1">
                        <label className="text-sm font-semibold text-slate-600">Frequency:</label>
                        <select 
                            value={frequencyLevel || ''} 
                            onChange={e => setFrequencyLevel(e.target.value ? Number(e.target.value) : undefined)} 
                            className="p-2 border rounded-md bg-slate-50 w-full disabled:opacity-70 disabled:cursor-not-allowed">
                            <option value="">All</option>
                            <option value="3">High (★★★)</option>
                            <option value="2">Medium (★★☆)</option>
                            <option value="1">Low (★☆☆)</option>
                        </select>
                    </div>
                </div>
            </fieldset>

             <div className="flex flex-col gap-2">
                <label className="text-sm font-semibold text-slate-600">Mode:</label>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
                    <ModeButton mode="listening">Listening</ModeButton>
                    <ModeButton mode="writing">Writing</ModeButton>
                    <ModeButton mode="en-jp-quiz">EN → JP Quiz</ModeButton>
                    <ModeButton mode="jp-en-quiz">JP → EN Quiz</ModeButton>
                </div>
            </div>
            
            {(studyMode === 'en-jp-quiz' || studyMode === 'jp-en-quiz') && (
                <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-lg flex flex-col sm:flex-row justify-between items-center gap-2">
                    <div className="text-sm text-blue-800">
                        <p><strong>Session Stats:</strong></p>
                        <p>Learned: <span className="font-bold">{sessionLearnedIds.size}</span> | For Review: <span className="font-bold">{sessionReviewIds.size}</span></p>
                    </div>
                    <button onClick={exportReviewList} className="bg-blue-500 text-white font-bold py-2 px-4 rounded-lg hover:bg-blue-600 transition text-sm whitespace-nowrap" disabled={sessionReviewIds.size === 0}>
                        Export Review List
                    </button>
                </div>
            )}

            <div className="border-t border-slate-200 mt-2 pt-4">
              <h3 className="text-sm font-semibold text-slate-600 mb-2">Or, start a focused review session:</h3>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleLoadReviewFile}
                className="hidden"
                accept=".json"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full bg-purple-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-purple-700 transition disabled:bg-slate-400 disabled:cursor-not-allowed"
                disabled={sessionSource === 'file' || isLoading}
              >
                Upload Review List (.json)
              </button>
            </div>
        </div>

        {renderContent()}
    </div>
  );
};

export default VocabularyMode;
