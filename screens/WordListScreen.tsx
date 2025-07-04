
import React, { useState, useEffect, useCallback } from 'react';
import { Level, VocabCategory, VocabDBItem, VocabType } from '../types';
import { LEVELS, VOCAB_CATEGORIES } from '../constants';
import { getPaginatedVocabulary, getAllVocabulary, getItemsWithoutFrequency, updateFrequencyLevels } from '../db';
import { assignFrequencyLevels } from '../services/geminiService';
import LoadingSpinner from '../components/LoadingSpinner';

interface WordListScreenProps {
  onGoHome: () => void;
}

const WordListScreen: React.FC<WordListScreenProps> = ({ onGoHome }) => {
  const [items, setItems] = useState<VocabDBItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);
  const [totalPages, setTotalPages] = useState(1);
  const [filteredCount, setFilteredCount] = useState(0);

  const [filters, setFilters] = useState<{
    level?: Level;
    category?: VocabCategory;
    type?: VocabType;
    search?: string;
    sortOrder?: 'default' | 'alphabetical';
    frequencyLevel?: number;
  }>({
    sortOrder: 'default',
  });
  
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisStatus, setAnalysisStatus] = useState('');
  const [uncategorizedCount, setUncategorizedCount] = useState(0);


  const fetchWords = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const { items: fetchedItems, total } = await getPaginatedVocabulary(currentPage, itemsPerPage, filters);
      setItems(fetchedItems);
      setTotalPages(Math.ceil(total / itemsPerPage));
      setFilteredCount(total);
    } catch (e) {
      console.error("Failed to fetch word list:", e);
      setError("Could not retrieve word list from the database.");
    } finally {
      setIsLoading(false);
    }
  }, [currentPage, itemsPerPage, filters]);

  const fetchUncategorizedCount = useCallback(async () => {
    try {
        const itemsToAnalyze = await getItemsWithoutFrequency();
        setUncategorizedCount(itemsToAnalyze.length);
    } catch (e) {
        console.error("Failed to fetch uncategorized count:", e);
    }
  }, []);

  useEffect(() => {
    fetchUncategorizedCount();
  }, [fetchUncategorizedCount]);

  useEffect(() => {
    const handler = setTimeout(() => {
      fetchWords();
    }, 300);
    return () => clearTimeout(handler);
  }, [fetchWords]);
  
  const handleFilterChange = (filterName: keyof typeof filters, value: string) => {
      setCurrentPage(1); // Reset to first page on filter change
      if (filterName === 'frequencyLevel') {
          const numValue = value ? parseInt(value, 10) : undefined;
          setFilters(prev => ({...prev, [filterName]: numValue }));
      } else {
          setFilters(prev => ({...prev, [filterName]: value || undefined }));
      }
  }
  
  const handleItemsPerPageChange = (value: string) => {
    setItemsPerPage(Number(value));
    setCurrentPage(1);
  };
  
  const handleExport = async (typeToExport: VocabType) => {
    alert(`Preparing all ${typeToExport}s for download. This might take a moment for large databases.`);
    try {
      const allItems = await getAllVocabulary();
      const itemsForType = allItems.filter(item => item.type === typeToExport);

      const validItemsForExport = itemsForType.filter(item => {
        const isValid =
          item &&
          typeof item.english === 'string' && item.english.length > 0 &&
          typeof item.japanese === 'string' &&
          typeof item.example_en === 'string' &&
          typeof item.example_jp === 'string' &&
          typeof item.level === 'string' &&
          typeof item.category === 'string' &&
          typeof item.type === 'string' && (item.type === 'word' || item.type === 'idiom');

        if (!isValid) {
          console.warn("Skipping potentially malformed item during JSON export:", item);
        }
        return isValid;
      }).map(item => ({
        english: item.english,
        japanese: item.japanese,
        pos: item.pos ?? null,
        example_en: item.example_en,
        example_jp: item.example_jp,
        level: item.level,
        category: item.category,
        type: item.type,
      }));
      
      if (validItemsForExport.length === 0) {
        alert(`No ${typeToExport}s found in the database to export.`);
        return;
      }

      const dataStr = JSON.stringify({ vocabulary: validItemsForExport }, null, 2);
      const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);

      const exportFileDefaultName = `toeic_${typeToExport}s_export.json`;

      const linkElement = document.createElement('a');
      linkElement.setAttribute('href', dataUri);
      linkElement.setAttribute('download', exportFileDefaultName);
      linkElement.click();
    } catch (e) {
      alert(`Failed to export ${typeToExport}s. Please check the console for errors.`);
      console.error(`Export for ${typeToExport} failed:`, e);
    }
  };

  const handleStartAnalysis = useCallback(async () => {
    setIsAnalyzing(true);
    setAnalysisStatus('Fetching uncategorized items...');
    try {
        const itemsToAnalyze = await getItemsWithoutFrequency();
        
        if (itemsToAnalyze.length === 0) {
            setAnalysisStatus('All items are already categorized. Nothing to do!');
            setIsAnalyzing(false);
            return;
        }

        const BATCH_SIZE = 100;
        const totalBatches = Math.ceil(itemsToAnalyze.length / BATCH_SIZE);
        let itemsProcessed = 0;

        for (let i = 0; i < totalBatches; i++) {
            const batch = itemsToAnalyze.slice(i * BATCH_SIZE, (i + 1) * BATCH_SIZE);
            setAnalysisStatus(`Analyzing batch ${i + 1} of ${totalBatches}... (${batch.length} items)`);
            
            const simplifiedBatch = batch.map(item => ({ id: item.id!, type: item.type, english: item.english }));
            const results = await assignFrequencyLevels(simplifiedBatch);
            
            if (results) {
                await updateFrequencyLevels(results);
                itemsProcessed += batch.length;
                await fetchUncategorizedCount();
            } else {
                throw new Error(`AI analysis failed for batch ${i + 1}. No results returned.`);
            }
        }
        
        setAnalysisStatus(`Analysis complete! Processed ${itemsProcessed} items.`);
        setIsAnalyzing(false);
        fetchWords(); // Re-fetch the list to show new data
    } catch (e: any) {
        console.error(e);
        setAnalysisStatus(`Error during analysis: ${e.message}. Process stopped.`);
        setIsAnalyzing(false);
    }
  }, [fetchUncategorizedCount, fetchWords]);

  const renderFrequency = (level?: number) => {
    if (level === undefined) return <span className="text-slate-400">-</span>;
    const stars = '★'.repeat(level) + '☆'.repeat(3 - level);
    const colors = ['text-slate-400', 'text-yellow-500', 'text-orange-500', 'text-red-500'];
    const tooltips = ['N/A', '低', '中', '高'];
    return <span className={`${colors[level]} font-bold`} title={`頻出度: ${tooltips[level]}`}>{stars}</span>;
  };

  const renderPagination = () => {
      if (totalPages <= 1) return null;
      
      return (
          <div className="flex justify-center items-center gap-2 mt-6">
              <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="px-4 py-2 bg-white border rounded-md shadow-sm disabled:opacity-50">&larr; Prev</button>
              <span className="text-slate-600">Page {currentPage} of {totalPages}</span>
              <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="px-4 py-2 bg-white border rounded-md shadow-sm disabled:opacity-50">Next &rarr;</button>
          </div>
      )
  }
  
  const selectClass = "w-full p-2 border rounded-md bg-white text-slate-800 focus:ring-2 focus:ring-blue-500 focus:border-blue-500";

  return (
    <div className="w-full max-w-5xl mx-auto p-4">
      <div className="flex justify-between items-center mb-6">
          <button onClick={onGoHome} className="text-blue-600 hover:text-blue-800">&larr; Back to Home</button>
          <h1 className="text-3xl font-bold text-slate-800">Vocabulary List</h1>
          <div className="flex gap-2">
            <button onClick={() => handleExport('word')} className="bg-green-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-green-700 transition text-sm">Export Words</button>
            <button onClick={() => handleExport('idiom')} className="bg-purple-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-purple-700 transition text-sm">Export Idioms</button>
          </div>
      </div>

       <div className="p-4 bg-white rounded-lg shadow-md mb-6">
          <h2 className="text-xl font-bold text-slate-700 mb-2">AI 頻出度分析</h2>
          <p className="text-slate-600 mb-3">
              データベース内の未分類の単語・熟語のTOEICでの頻出度をAIが分析し、高・中・低の3段階でレベルを割り振ります。
          </p>
          <div className="flex flex-col sm:flex-row gap-4 items-center">
              <button onClick={handleStartAnalysis} disabled={isAnalyzing || uncategorizedCount === 0} className="bg-indigo-600 text-white font-bold py-3 px-6 rounded-lg hover:bg-indigo-700 transition disabled:bg-slate-400 disabled:cursor-not-allowed flex-grow">
                  {isAnalyzing ? "分析中..." : `頻出度の振り分けを開始 (${uncategorizedCount}件)`}
              </button>
              {isAnalyzing && (
                  <div className="w-full sm:w-auto flex items-center gap-3">
                      <LoadingSpinner />
                      <span className="text-indigo-700 font-semibold">{analysisStatus}</span>
                  </div>
              )}
          </div>
          {!isAnalyzing && analysisStatus && <p className="text-sm text-slate-600 mt-2">{analysisStatus}</p>}
      </div>

      <div className="p-4 bg-white rounded-lg shadow-md mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <input type="text" placeholder="Search English/Japanese..." onChange={e => handleFilterChange('search', e.target.value)} className={`${selectClass} lg:col-span-4`} />
            <select onChange={e => handleFilterChange('level', e.target.value)} className={selectClass}>
                <option value="">All Levels</option>
                {LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
            </select>
            <select onChange={e => handleFilterChange('category', e.target.value)} className={selectClass}>
                <option value="">All Categories</option>
                {VOCAB_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <select onChange={e => handleFilterChange('type', e.target.value)} className={selectClass}>
                <option value="">All Types</option>
                <option value="word">Word</option>
                <option value="idiom">Idiom</option>
            </select>
            <select onChange={e => handleFilterChange('frequencyLevel', e.target.value)} className={selectClass}>
              <option value="">All Frequencies</option>
              <option value="3">高 (★★★)</option>
              <option value="2">中 (★★☆)</option>
              <option value="1">低 (★☆☆)</option>
            </select>
             <select value={filters.sortOrder} onChange={e => handleFilterChange('sortOrder', e.target.value)} className={selectClass}>
              <option value="default">Default Order</option>
              <option value="alphabetical">Alphabetical (A-Z)</option>
            </select>
            <select value={itemsPerPage} onChange={e => handleItemsPerPageChange(e.target.value)} className={selectClass}>
              <option value="20">20 / page</option>
              <option value="40">40 / page</option>
              <option value="100">100 / page</option>
            </select>
        </div>
      </div>

      {isLoading ? <LoadingSpinner /> : error ? <p className="text-red-500 text-center">{error}</p> : (
          <div>
              <div className="mb-4 text-slate-600">
                  Found <span className="font-bold">{filteredCount}</span> matching items.
              </div>
              <div className="bg-white rounded-lg shadow-md overflow-x-auto">
                  <table className="min-w-full divide-y divide-slate-200">
                      <thead className="bg-slate-50">
                          <tr>
                              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">English</th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Japanese</th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider hidden md:table-cell">Details</th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider hidden lg:table-cell">Frequency</th>
                          </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-slate-200">
                          {items.map(item => (
                              <tr key={item.id}>
                                  <td className="px-6 py-4 whitespace-normal">
                                      <div className="text-sm font-medium text-slate-900">{item.english}</div>
                                      <div className="text-sm text-slate-500 hidden sm:block">{item.example_en}</div>
                                  </td>
                                  <td className="px-6 py-4 whitespace-normal">
                                       <div className="text-sm text-slate-900">{item.japanese}</div>
                                       <div className="text-sm text-slate-500 hidden sm:block">{item.example_jp}</div>
                                  </td>

                                  <td className="px-4 py-4 whitespace-normal hidden md:table-cell">
                                      <div className="flex flex-col gap-1 items-start">
                                        <span className={`capitalize text-xs font-semibold py-1 px-2 rounded-full ${item.type === 'idiom' ? 'bg-purple-200 text-purple-800' : 'bg-green-200 text-green-800'}`}>{item.type}</span>
                                        {item.pos && <span className="capitalize text-xs font-semibold py-1 px-2 rounded-full bg-blue-200 text-blue-800">{item.pos}</span>}
                                        <span className="text-xs text-slate-500 py-1 px-2">{item.level}</span>
                                      </div>
                                  </td>
                                  <td className="px-4 py-4 whitespace-nowrap text-lg text-center hidden lg:table-cell">
                                    {renderFrequency(item.frequencyLevel)}
                                  </td>
                              </tr>
                          ))}
                      </tbody>
                  </table>
              </div>
              {items.length === 0 && <p className="text-center text-slate-500 p-8">No items match your filters.</p>}
              {renderPagination()}
          </div>
      )}
    </div>
  );
};

export default WordListScreen;