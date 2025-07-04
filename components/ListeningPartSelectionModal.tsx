
import React from 'react';
import { ListeningPart } from '../types';
import { LISTENING_PARTS } from '../constants';

interface ListeningPartSelectionModalProps {
  onSelectPart: (part: ListeningPart | 'Random') => void;
  onClose: () => void;
}

const ListeningPartSelectionModal: React.FC<ListeningPartSelectionModalProps> = ({ onSelectPart, onClose }) => {
  const allOptions: (ListeningPart | 'Random')[] = ['Random', ...LISTENING_PARTS];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl p-6 md:p-8 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-2xl font-bold text-center text-slate-800 mb-6">Select Listening Part</h2>
        <div className="grid grid-cols-2 gap-4">
          {allOptions.map((part) => (
            <button
              key={part}
              onClick={() => onSelectPart(part)}
              className="bg-teal-600 text-white font-semibold py-3 px-4 rounded-lg hover:bg-teal-700 transition-transform transform hover:scale-105 shadow-md"
            >
              {part}
            </button>
          ))}
        </div>
        <div className="text-center mt-8">
            <button onClick={onClose} className="text-slate-500 hover:text-slate-700 font-semibold py-2 px-4">Cancel</button>
        </div>
      </div>
    </div>
  );
};

export default ListeningPartSelectionModal;
