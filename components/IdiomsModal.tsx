
import React from 'react';
import { ReadingPassage } from '../types';
import CloseIcon from './icons/CloseIcon';
import SoundIcon from './icons/SoundIcon';
import { useTextToSpeech } from '../hooks/useTextToSpeech';

interface IdiomsModalProps {
  idioms: ReadingPassage['idioms'];
  isOpen: boolean;
  onClose: () => void;
}

const IdiomsModal: React.FC<IdiomsModalProps> = ({ idioms, isOpen, onClose }) => {
  const { speak, stop, isSpeaking } = useTextToSpeech();

  if (!isOpen) return null;

  const handlePlay = (text: string, lang: 'en-US' | 'ja-JP') => {
    stop();
    speak(text, lang);
  }

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-2xl shadow-xl w-full max-w-lg h-auto max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center p-4 border-b border-slate-200 flex-shrink-0">
          <h2 className="text-xl font-bold text-slate-800">Key Idioms & Phrases</h2>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-800">
            <CloseIcon className="w-7 h-7" />
          </button>
        </div>
        <div className="p-6 overflow-y-auto space-y-4">
          {idioms.map((idiom, index) => (
              <div key={index} className="p-4 border rounded-lg bg-slate-50">
                  <div className="flex justify-between items-center">
                      <div>
                          <p className="text-lg font-semibold text-slate-800">{idiom.english}</p>
                          <p className="text-md text-slate-600">{idiom.japanese}</p>
                      </div>
                      <div className="flex gap-2">
                          <button onClick={() => handlePlay(idiom.english, 'en-US')} className="text-blue-500 hover:text-blue-700 disabled:text-slate-400" disabled={isSpeaking}>
                              <SoundIcon className="w-6 h-6"/>
                          </button>
                          <button onClick={() => handlePlay(idiom.japanese, 'ja-JP')} className="text-green-500 hover:text-green-700 disabled:text-slate-400" disabled={isSpeaking}>
                              <SoundIcon className="w-6 h-6"/>
                          </button>
                      </div>
                  </div>
              </div>
          ))}
          {idioms.length === 0 && (
            <p className="text-slate-500 text-center py-4">No specific idioms or key phrases were highlighted for this passage.</p>
          )}
        </div>
        <div className="p-4 border-t border-slate-200 text-right flex-shrink-0">
            <button 
                onClick={onClose} 
                className="bg-blue-600 text-white font-bold py-2 px-6 rounded-lg hover:bg-blue-700 transition"
            >
                Close
            </button>
        </div>
      </div>
    </div>
  );
};

export default IdiomsModal;
