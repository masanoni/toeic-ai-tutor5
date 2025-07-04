
import React from 'react';
import { VocabCategory } from '../types';
import { VOCAB_CATEGORIES } from '../constants';

interface CategorySelectionModalProps {
  onSelectCategory: (category: VocabCategory | 'Random') => void;
  onClose: () => void;
}

const CategorySelectionModal: React.FC<CategorySelectionModalProps> = ({ onSelectCategory, onClose }) => {
  const allOptions: (VocabCategory | 'Random')[] = ['Random', ...VOCAB_CATEGORIES];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl p-6 md:p-8 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-2xl font-bold text-center text-slate-800 mb-6">Select a Category</h2>
        <div className="grid grid-cols-2 gap-4">
          {allOptions.map((cat) => (
            <button
              key={cat}
              onClick={() => onSelectCategory(cat)}
              className="bg-blue-600 text-white font-semibold py-3 px-4 rounded-lg hover:bg-blue-700 transition-transform transform hover:scale-105 shadow-md"
            >
              {cat}
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

export default CategorySelectionModal;
