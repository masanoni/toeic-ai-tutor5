
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Level, VocabCategory, ReadingPassage, Sentence } from '../types';
import { generateReadingPassage } from '../services/geminiService';
import { useTextToSpeech, SpeechCancellationError } from '../hooks/useTextToSpeech';
import LoadingSpinner from '../components/LoadingSpinner';
import PlayIcon from '../components/icons/PlayIcon';
import PauseIcon from '../components/icons/PauseIcon';
import { LEVELS, VOCAB_CATEGORIES } from '../constants';

interface ReadingDriveModeProps {
  onGoHome: () => void;
  initialCategory: VocabCategory | 'Random';
  level: Level;
}

type PlaybackMode = 'sentence' | 'full';
type PlayState = 'playing' | 'paused' | 'finished' | 'reviewing';
type PlayingPart = 'english' | 'japanese' | null;

const ReadingDriveMode: React.FC<ReadingDriveModeProps> = ({ onGoHome, initialCategory, level }) => {
  const [passageData, setPassageData] = useState<ReadingPassage | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [playbackMode, setPlaybackMode] = useState<PlaybackMode>('sentence');
  const [playState, setPlayState] = useState<PlayState>('paused');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [playingPart, setPlayingPart] = useState<PlayingPart>(null);
  
  const [currentLevel, setCurrentLevel] = useState<Level>(level);

  const { speak, stop, isSpeaking } = useTextToSpeech();

  const fetchPassage = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    stop();
    setPassageData(null);
    setPlayState('paused');
    setCurrentIndex(0);
    setPlayingPart(null);
    try {
      const categoryToFetch = initialCategory === 'Random'
        ? VOCAB_CATEGORIES[Math.floor(Math.random() * VOCAB_CATEGORIES.length)]
        : initialCategory;
      const data = await generateReadingPassage(currentLevel, categoryToFetch);
      if (!data) setError("Could not generate a reading passage. Please try again.");
      setPassageData(data);
    } catch (e) {
      setError("An error occurred while fetching the passage.");
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  }, [currentLevel, initialCategory, stop]);

  useEffect(() => {
    fetchPassage();
    return () => stop();
  }, [fetchPassage, stop]);
  
  const currentSentence = useMemo(() => {
    if (!passageData) return null;
    if (playState === 'reviewing') {
       const keyIndex = passageData.key_sentence_indices[currentIndex];
       return passageData.passage[keyIndex];
    }
    return passageData.passage[currentIndex];
  }, [passageData, currentIndex, playState]);
  
  const playSentenceBySentence = useCallback(async () => {
    if (!passageData || currentIndex >= passageData.passage.length) {
      setPlayState('finished');
      setPlayingPart(null);
      return;
    }
    
    setPlayState('playing');

    try {
      const sentence = passageData.passage[currentIndex];
      setPlayingPart('english');
      await speak(sentence.english, 'en-US');
      
      await new Promise(r => setTimeout(r, 500));
      
      setPlayingPart('japanese');
      await speak(sentence.japanese, 'ja-JP');

      setCurrentIndex(i => i + 1);
    } catch (error) {
        if (error instanceof SpeechCancellationError) {
            console.log('Sentence playback cancelled.');
        } else {
            console.error("An error occurred during sentence playback:", error);
            setPlayState('paused');
            setPlayingPart(null);
        }
    }
  }, [passageData, currentIndex, speak]);

  const playKeySentenceReview = useCallback(async () => {
    if (!passageData || currentIndex >= passageData.key_sentence_indices.length) {
        setPlayState('finished');
        setPlayingPart(null);
        return;
    }

    const keySentenceIndex = passageData.key_sentence_indices[currentIndex];
    const sentenceToPlay = passageData.passage[keySentenceIndex];

    setPlayState('reviewing');

    try {
      setPlayingPart('english');
      await speak(sentenceToPlay.english, 'en-US');
      
      await new Promise(r => setTimeout(r, 500));
      
      setPlayingPart('japanese');
      await speak(sentenceToPlay.japanese, 'ja-JP');
      
      setCurrentIndex(i => i + 1);
    } catch (error) {
        if (error instanceof SpeechCancellationError) {
            console.log('Key sentence review cancelled.');
        } else {
            console.error("An error occurred during key sentence review:", error);
            setPlayState('paused');
            setPlayingPart(null);
        }
    }
  }, [passageData, currentIndex, speak]);


  useEffect(() => {
      if (playState === 'playing') {
          playSentenceBySentence();
      } else if (playState === 'reviewing') {
          playKeySentenceReview();
      }
  }, [currentIndex, playState, playSentenceBySentence, playKeySentenceReview]);
  
  const handlePlayPause = () => {
    if (isSpeaking) {
      stop();
      setPlayState('paused');
      setPlayingPart(null);
    } else {
       if (playState === 'paused' || playState === 'finished') {
           setCurrentIndex(0);
           setPlayState('playing');
       }
    }
  };

  const handleStartReview = () => {
      stop();
      setCurrentIndex(0);
      setPlayState('reviewing');
  }

  const renderContent = () => {
    if (isLoading) return <LoadingSpinner />;
    if (error) return <p className="text-center text-red-500 bg-red-100 p-4 rounded-lg">{error}</p>;
    if (!passageData) return <p className="text-center text-slate-500 p-4">No passage loaded.</p>;

    return (
        <div className="w-full flex flex-col items-center justify-center text-center">
            <div className="w-full bg-white p-6 rounded-xl shadow-md min-h-[12rem] flex flex-col justify-center">
                {currentSentence ? (
                    <>
                        <h2 className={`text-2xl md:text-3xl font-bold mb-2 break-words transition-colors duration-300 ${playingPart === 'english' ? 'text-blue-600' : 'text-slate-800'}`}>
                            {currentSentence.english}
                        </h2>
                        <p className={`text-xl md:text-2xl text-slate-600 transition-colors duration-300 ${playingPart === 'japanese' ? 'text-blue-600' : 'text-slate-600'}`}>
                            {currentSentence.japanese}
                        </p>
                    </>
                ) : (
                    <p className="text-xl text-slate-500">Ready to start.</p>
                )}
            </div>

            <div className="mt-8 flex items-center justify-center gap-8">
                <button onClick={handlePlayPause} className="text-blue-600 bg-white rounded-full p-2 shadow-lg hover:bg-slate-100 transition focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">
                    {isSpeaking ? <PauseIcon className="w-16 h-16"/> : <PlayIcon className="w-16 h-16"/>}
                </button>
            </div>
            {playState === 'finished' && passageData.key_sentence_indices.length > 0 && (
                <div className="mt-8">
                    <button onClick={handleStartReview} className="bg-green-600 text-white font-bold py-3 px-6 rounded-lg text-lg hover:bg-green-700 transition">
                        Review Key Sentences
                    </button>
                </div>
            )}
        </div>
    )
  }

  return (
    <div className="w-full max-w-3xl mx-auto p-4 flex flex-col h-[calc(100vh-2rem)]">
        <div className="flex justify-between items-center mb-6 flex-shrink-0">
            <button onClick={onGoHome} className="text-blue-600 hover:text-blue-800">&larr; Back to Home</button>
            <h1 className="text-2xl font-bold text-slate-800">Reading Drive: <span className="text-blue-600">{initialCategory}</span></h1>
            <div/>
        </div>

        <div className="mb-6 p-4 bg-white rounded-lg shadow-md flex flex-col gap-4 flex-shrink-0">
             <div className="flex items-center gap-2">
                <label className="font-semibold text-slate-600">Level:</label>
                <select value={currentLevel} onChange={e => setCurrentLevel(e.target.value as Level)} className="flex-1 p-2 border rounded-md bg-slate-50 focus:ring-2 focus:ring-blue-500" disabled={isLoading || isSpeaking}>
                    {LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
                </select>
            </div>
        </div>

        <div className="flex-grow flex flex-col items-center justify-center bg-slate-200 rounded-2xl p-4 md:p-8">
           {renderContent()}
           <button onClick={fetchPassage} disabled={isLoading || isSpeaking} className="mt-8 text-slate-600 font-semibold py-2 px-4 rounded-lg hover:bg-slate-300 transition text-sm disabled:opacity-50">
               Load New Passage
           </button>
        </div>
    </div>
  );
};

export default ReadingDriveMode;
