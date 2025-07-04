
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Level, VocabCategory, VocabDBItem, VocabType, PartOfSpeech, SortOrder } from '../types';
import { VOCAB_CATEGORIES, LEVELS, PARTS_OF_SPEECH, GENERATOR_CATEGORIES, ALL_CATEGORIES } from '../constants';
import { getAllVocabularyForLevelAndCategory } from '../db';
import { useTextToSpeech, SpeechCancellationError } from '../hooks/useTextToSpeech';
import LoadingSpinner from '../components/LoadingSpinner';
import PlayIcon from '../components/icons/PlayIcon';
import PauseIcon from '../components/icons/PauseIcon';
import NextIcon from '../components/icons/NextIcon';

interface DriveModeProps {
  level: Level;
  onGoHome: () => void;
}

type PlayingPart = 'english' | 'japanese' | 'example_en' | 'example_jp' | null;
type VocabSelection = VocabType | 'all';
type PlayState = 'playing' | 'paused';

const DriveMode: React.FC<DriveModeProps> = ({ level, onGoHome }) => {
  const [currentLevel, setCurrentLevel] = useState<Level>(level);
  const [category, setCategory] = useState<VocabCategory | typeof ALL_CATEGORIES>(ALL_CATEGORIES);
  const [playlist, setPlaylist] = useState<VocabDBItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [playState, setPlayState] = useState<PlayState>('paused');
  const [playingPart, setPlayingPart] = useState<PlayingPart>(null);
  const [vocabSelection, setVocabSelection] = useState<VocabSelection>('word');
  const [posFilter, setPosFilter] = useState<PartOfSpeech | 'all'>('all');
  const [sortOrder, setSortOrder] = useState<SortOrder>('Random');
  const [frequencyLevel, setFrequencyLevel] = useState<number | undefined>();

  const { speak, stop } = useTextToSpeech();

  useEffect(() => {
    setCurrentLevel(level);
  }, [level]);

  const currentItem = useMemo(() => playlist[currentIndex], [playlist, currentIndex]);

  const loadPlaylist = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    setPlaylist([]);
    setCurrentIndex(0);
    setPlayState('paused');
    setPlayingPart(null);
    stop();
    try {
      let items: VocabDBItem[] = [];
      if (category === ALL_CATEGORIES) {
        const promises = VOCAB_CATEGORIES.map(cat => 
          getAllVocabularyForLevelAndCategory(currentLevel, cat, vocabSelection, posFilter, 'Random', frequencyLevel)
        );
        const results = await Promise.all(promises);
        items = results.flat();
      } else {
        items = await getAllVocabularyForLevelAndCategory(currentLevel, category, vocabSelection, posFilter, sortOrder, frequencyLevel);
      }

      if (items.length === 0) {
        setError(`No vocabulary found for this selection. Try changing filters or wait for more words to be generated.`);
      } else {
         if (sortOrder === 'Random') {
            // Shuffle the final combined list
            for (let i = items.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [items[i], items[j]] = [items[j], items[i]];
            }
         }
        setPlaylist(items);
      }
    } catch (e) {
      setError("An error occurred while fetching vocabulary.");
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  }, [currentLevel, category, vocabSelection, posFilter, sortOrder, stop, frequencyLevel]);

  useEffect(() => {
    loadPlaylist();
    return () => stop();
  }, [loadPlaylist]);

  const handleNext = useCallback(() => {
    stop();
    setPlayingPart(null);
    setCurrentIndex(prev => (prev + 1) % (playlist.length || 1));
  }, [stop, playlist.length]);

  const handlePlayPause = useCallback(() => {
    if (playState === 'playing') {
      setPlayState('paused');
    } else if (playlist.length > 0) {
      setPlayState('playing');
    }
  }, [playState, playlist.length]);
  
  // This effect is the main playback engine.
  useEffect(() => {
    if (playState !== 'playing' || !currentItem) {
      return;
    }

    let isCancelled = false;

    const playSequence = async () => {
      try {
        const item = currentItem;
        
        // Add initial delay
        await new Promise(r => setTimeout(r, 2000));
        if (isCancelled) return;
        
        setPlayingPart('english');
        await speak(item.english, 'en-US');
        if (isCancelled) return;
        
        await new Promise(r => setTimeout(r, 2000));
        if (isCancelled) return;
        
        setPlayingPart('japanese');
        await speak(item.japanese, 'ja-JP');
        if (isCancelled) return;
        
        await new Promise(r => setTimeout(r, 2000));
        if (isCancelled) return;
        
        setPlayingPart('example_en');
        await speak(item.example_en, 'en-US');
        if (isCancelled) return;
        
        await new Promise(r => setTimeout(r, 2000));
        if (isCancelled) return;
        
        setPlayingPart('example_jp');
        await speak(item.example_jp, 'ja-JP');
        if (isCancelled) return;
        
        // End of sequence, auto-advance to the next item
        await new Promise(r => setTimeout(r, 2000));
        if (isCancelled) return;

        handleNext();

      } catch (error) {
        if (error instanceof SpeechCancellationError) {
          console.log("Playback cancelled.");
        } else {
          console.error("An error occurred during speech playback:", error);
          setPlayState('paused');
        }
      }
    };

    playSequence();

    return () => {
      isCancelled = true;
      stop();
    };
  }, [playState, currentItem, handleNext, speak, stop]);
  
  const renderDisplay = () => {
      if (!currentItem) return null;

      const TextLine = ({ text, highlight, sizeClass }: { text: string; highlight: boolean, sizeClass: string }) => (
          <p className={`${sizeClass} break-words transition-colors duration-300 ${highlight ? 'text-blue-600 font-bold' : 'text-slate-800'}`}>
              {text}
          </p>
      );

      return (
          <div className="text-left mb-8 bg-white p-6 rounded-xl shadow-md w-full space-y-3">
              <div className="flex justify-between items-center">
                   <p className="text-sm text-slate-500">{currentIndex + 1} / {playlist.length}</p>
                   <div className="flex gap-2 items-center">
                        {currentItem.pos && (
                            <span className="capitalize text-xs font-semibold py-1 px-2 rounded-full bg-blue-200 text-blue-800">{currentItem.pos.toLowerCase()}</span>
                        )}
                        <span className={`capitalize text-xs font-semibold py-1 px-2 rounded-full ${currentItem.type === 'idiom' ? 'bg-purple-200 text-purple-800' : 'bg-green-200 text-green-800'}`}>{currentItem.type}</span>
                   </div>
              </div>
              <TextLine text={currentItem.english} highlight={playingPart === 'english'} sizeClass="text-2xl md:text-3xl font-bold" />
              <TextLine text={currentItem.japanese} highlight={playingPart === 'japanese'} sizeClass="text-xl md:text-2xl" />
              <hr className="my-2 border-slate-200"/>
              <TextLine text={currentItem.example_en} highlight={playingPart === 'example_en'} sizeClass="text-lg" />
              <TextLine text={currentItem.example_jp} highlight={playingPart === 'example_jp'} sizeClass="text-base text-slate-600" />
          </div>
      );
  }

  const renderControls = () => {
    if (isLoading) return <LoadingSpinner />;
    if (error) return <p className="text-center text-red-500 p-4">{error}</p>;
    if (playlist.length === 0) return <p className="text-center text-slate-500 p-4">Select filters and start learning.</p>;

    return (
        <div className="flex flex-col items-center gap-8">
            <div className="flex items-center justify-center gap-8">
                <button onClick={handlePlayPause} className="text-blue-600 bg-white rounded-full p-2 shadow-lg hover:bg-slate-100 transition focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">
                    {playState === 'playing' ? <PauseIcon className="w-16 h-16"/> : <PlayIcon className="w-16 h-16"/>}
                </button>
                 <button onClick={handleNext} disabled={playState === 'playing'} className="text-slate-700 bg-white rounded-full p-2 shadow-lg hover:bg-slate-100 transition disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-500">
                    <NextIcon className="w-12 h-12"/>
                </button>
            </div>
        </div>
    );
  }
  
  const VocabTypeButton: React.FC<{ type: VocabSelection, children: React.ReactNode }> = ({ type, children }) => (
      <button onClick={() => setVocabSelection(type)} disabled={playState === 'playing' || isLoading} className={`flex-1 px-4 py-2 rounded-md text-sm font-semibold transition ${vocabSelection === type ? 'bg-white shadow' : 'disabled:opacity-50'}`}>{children}</button>
  );

  return (
    <div className="w-full max-w-3xl mx-auto p-4 flex flex-col h-[calc(100vh-2rem)]">
        <div className="flex justify-between items-center mb-6 flex-shrink-0">
            <button onClick={onGoHome} className="text-blue-600 hover:text-blue-800">&larr; Back to Home</button>
            <h1 className="text-2xl font-bold text-slate-800">Drive Mode</h1>
            <div/>
        </div>

        <div className="mb-6 p-4 bg-white rounded-lg shadow-md flex flex-col gap-4 flex-shrink-0">
             <div className="grid grid-cols-2 md:grid-cols-3 gap-4 items-end">
                 <div>
                    <label htmlFor="level-select" className="block text-sm font-semibold text-slate-600 mb-1">Level:</label>
                    <select
                      id="level-select"
                      value={currentLevel}
                      onChange={e => setCurrentLevel(e.target.value as Level)}
                      disabled={playState === 'playing' || isLoading}
                      className="w-full p-2 border rounded-md bg-slate-50 focus:ring-2 focus:ring-blue-500"
                    >
                        {LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
                    </select>
                </div>
                 <div>
                    <label htmlFor="category-select" className="block text-sm font-semibold text-slate-600 mb-1">Category:</label>
                    <select
                      id="category-select"
                      value={category}
                      onChange={e => setCategory(e.target.value as VocabCategory | typeof ALL_CATEGORIES)}
                      disabled={playState === 'playing' || isLoading}
                      className="w-full p-2 border rounded-md bg-slate-50 focus:ring-2 focus:ring-blue-500"
                    >
                        {GENERATOR_CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                    </select>
                </div>
                <div>
                    <label className="block text-sm font-semibold text-slate-600 mb-1">Practice:</label>
                    <div className="flex-1 flex gap-1 rounded-lg p-1 bg-slate-200">
                       <VocabTypeButton type="word">Words</VocabTypeButton>
                       <VocabTypeButton type="idiom">Idioms</VocabTypeButton>
                       <VocabTypeButton type="all">All</VocabTypeButton>
                    </div>
                </div>
                <div>
                    <label className="block text-sm font-semibold text-slate-600 mb-1">Order:</label>
                    <select value={sortOrder} onChange={e => setSortOrder(e.target.value as SortOrder)} className="p-2 border rounded-md bg-slate-50 w-full" disabled={playState === 'playing' || isLoading}>
                        <option value="Random">Random</option>
                        <option value="Alphabetical">Alphabetical</option>
                    </select>
                </div>
                {vocabSelection === 'word' && (
                    <div>
                        <label className="block text-sm font-semibold text-slate-600 mb-1">Part of Speech:</label>
                        <select value={posFilter} onChange={e => setPosFilter(e.target.value as PartOfSpeech | 'all')} className="p-2 border rounded-md bg-slate-50 w-full" disabled={playState === 'playing' || isLoading}>
                            <option value="all">All Parts of Speech</option>
                            {PARTS_OF_SPEECH.map(pos => <option key={pos} value={pos}>{pos}</option>)}
                        </select>
                    </div>
                )}
                <div>
                    <label className="block text-sm font-semibold text-slate-600 mb-1">Frequency:</label>
                    <select 
                        value={frequencyLevel || ''} 
                        onChange={e => setFrequencyLevel(e.target.value ? Number(e.target.value) : undefined)} 
                        disabled={playState === 'playing' || isLoading} 
                        className="p-2 border rounded-md bg-slate-50 w-full"
                    >
                        <option value="">All Frequencies</option>
                        <option value="3">High (★★★)</option>
                        <option value="2">Medium (★★☆)</option>
                        <option value="1">Low (★☆☆)</option>
                    </select>
                </div>
            </div>
        </div>

        <div className="flex-grow flex flex-col items-center justify-center bg-slate-200 rounded-2xl p-4 md:p-8">
           {renderDisplay()}
           {renderControls()}
        </div>
    </div>
  );
};

export default DriveMode;
