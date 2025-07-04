
import React from 'react';
import { Sentence } from '../types';
import CloseIcon from './icons/CloseIcon';

interface ScriptModalProps {
  passage: Sentence[];
  title: string;
  onClose: () => void;
}

const ScriptModal: React.FC<ScriptModalProps> = ({ passage, title, onClose }) => {
  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-2xl shadow-xl w-full max-w-2xl h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center p-4 border-b border-slate-200 flex-shrink-0">
          <h2 className="text-xl font-bold text-slate-800">{title} - Full Script</h2>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-800">
            <CloseIcon className="w-7 h-7" />
          </button>
        </div>
        <div className="p-6 overflow-y-auto space-y-4">
          {passage.map((sentence, i) => (
            <div key={i} className="p-3 bg-slate-50 rounded-lg">
              <p className="text-slate-800 font-medium leading-relaxed">{sentence.english}</p>
              <p className="text-slate-500 mt-1 leading-relaxed">{sentence.japanese}</p>
            </div>
          ))}
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

export default ScriptModal;
