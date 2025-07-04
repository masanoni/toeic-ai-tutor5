
import { openDB, DBSchema, IDBPDatabase } from 'idb';
import type { VocabDBItem, Level, VocabCategory, VocabType, PartOfSpeech, SortOrder } from './types';
import { ALL_LEVELS, ALL_CATEGORIES, PARTS_OF_SPEECH } from './constants';


const DB_NAME = 'TOEICAI_TUTOR_DB';
const DB_VERSION = 5; 
const WORDS_STORE_NAME = 'words';
const IDIOMS_STORE_NAME = 'idioms';
const OLD_VOCAB_STORE_NAME = 'vocabulary';


interface TOEICDB extends DBSchema {
  [WORDS_STORE_NAME]: {
    key: number;
    value: VocabDBItem;
    indexes: {
      'english_pos': [string, PartOfSpeech];
      'level_category': [Level, VocabCategory];
      'frequencyLevel': number;
    };
  };
  [IDIOMS_STORE_NAME]: {
    key: number;
    value: VocabDBItem;
    indexes: {
      'english': string;
      'level_category': [Level, VocabCategory];
      'frequencyLevel': number;
    };
  };
  // For migration purposes, the old store might exist temporarily
  [OLD_VOCAB_STORE_NAME]?: {
    key: number;
    value: VocabDBItem;
    indexes: {
      'english_pos_type': [string, PartOfSpeech | null, VocabType];
      'level_category': [Level, VocabCategory];
      'level_category_type': [Level, VocabCategory, VocabType];
    };
  };
}

let dbPromise: Promise<IDBPDatabase<TOEICDB>> | null = null;

const getDb = (): Promise<IDBPDatabase<TOEICDB>> => {
    if (!dbPromise) {
        dbPromise = openDB<TOEICDB>(DB_NAME, DB_VERSION, {
            async upgrade(db, oldVersion, newVersion, tx) {
                console.log(`Upgrading database from version ${oldVersion} to ${newVersion}...`);
                
                if (oldVersion < 4) {
                     console.log("Applying version 4 upgrade: Separating words and idioms.");

                    if (!db.objectStoreNames.contains(WORDS_STORE_NAME)) {
                        const wordsStore = db.createObjectStore(WORDS_STORE_NAME, { keyPath: 'id', autoIncrement: true });
                        wordsStore.createIndex('english_pos', ['english', 'pos'], { unique: true });
                        wordsStore.createIndex('level_category', ['level', 'category'], { unique: false });
                    }
                     if (!db.objectStoreNames.contains(IDIOMS_STORE_NAME)) {
                        const idiomsStore = db.createObjectStore(IDIOMS_STORE_NAME, { keyPath: 'id', autoIncrement: true });
                        idiomsStore.createIndex('english', 'english', { unique: true });
                        idiomsStore.createIndex('level_category', ['level', 'category'], { unique: false });
                     }

                    // Migrate data if old 'vocabulary' store exists
                    if (db.objectStoreNames.contains(OLD_VOCAB_STORE_NAME)) {
                        console.log("Migrating data from old 'vocabulary' store...");
                        const oldStore = tx.objectStore(OLD_VOCAB_STORE_NAME);
                        const wordsTxStore = tx.objectStore(WORDS_STORE_NAME);
                        const idiomsTxStore = tx.objectStore(IDIOMS_STORE_NAME);
                        let cursor = await oldStore.openCursor();
                        while (cursor) {
                            const item = cursor.value;
                            // remove optional id before adding
                            const { id, ...data } = item;
                            if (item.type === 'word' && item.pos && PARTS_OF_SPEECH.includes(item.pos)) {
                                await wordsTxStore.add(data as VocabDBItem).catch(e => console.warn("Skipping duplicate word during migration:", item.english, e.message));
                            } else if (item.type === 'idiom') {
                                await idiomsTxStore.add(data as VocabDBItem).catch(e => console.warn("Skipping duplicate idiom during migration:", item.english, e.message));
                            }
                            cursor = await cursor.continue();
                        }
                        db.deleteObjectStore(OLD_VOCAB_STORE_NAME);
                        console.log("Migration complete. Old 'vocabulary' store deleted.");
                    }
                }
                if (oldVersion < 5) {
                    console.log("Applying version 5 upgrade: Adding frequencyLevel index.");
                    const wordsStore = tx.objectStore(WORDS_STORE_NAME);
                    if (!wordsStore.indexNames.contains('frequencyLevel')) {
                        wordsStore.createIndex('frequencyLevel', 'frequencyLevel', { unique: false });
                    }
                    const idiomsStore = tx.objectStore(IDIOMS_STORE_NAME);
                    if (!idiomsStore.indexNames.contains('frequencyLevel')) {
                        idiomsStore.createIndex('frequencyLevel', 'frequencyLevel', { unique: false });
                    }
                }
            },
        });
    }
    return dbPromise;
};

export const addVocabularyItems = async (items: VocabDBItem[]): Promise<number> => {
    const db = await getDb();
    const tx = db.transaction([WORDS_STORE_NAME, IDIOMS_STORE_NAME], 'readwrite');
    const wordsStore = tx.objectStore(WORDS_STORE_NAME);
    const idiomsStore = tx.objectStore(IDIOMS_STORE_NAME);
    const wordsIndex = wordsStore.index('english_pos');
    const idiomsIndex = idiomsStore.index('english');
    let addedCount = 0;

    try {
        for (const item of items) {
             if (!item || typeof item.english !== 'string' || !item.english || !item.type) {
                console.warn('Skipping item with invalid base properties (english/type):', item);
                continue;
            }

            // Final check on all required fields for the record itself.
            if (!item.japanese || !item.example_en || !item.example_jp || !item.level || !item.category) {
                 console.warn('Skipping item with missing core data fields:', item);
                 continue;
            }

            // remove optional id before adding
            const { id, ...data } = item;

            if (item.type === 'word') {
                if (item.pos && PARTS_OF_SPEECH.includes(item.pos)) {
                    const existing = await wordsIndex.get([item.english, item.pos]);
                    if (!existing) {
                        await wordsStore.add(data as VocabDBItem);
                        addedCount++;
                    }
                } else {
                    console.warn('Skipping invalid word item (bad or missing POS):', item);
                }
            } else if (item.type === 'idiom') {
                const existing = await idiomsIndex.get(item.english);
                if (!existing) {
                    const itemToAdd = {...data, pos: null };
                    await idiomsStore.add(itemToAdd as VocabDBItem);
                    addedCount++;
                }
            }
        }
        await tx.done;
    } catch (error) {
        console.error("Transaction aborted during addVocabularyItems:", error);
        tx.abort();
        throw error;
    }

    return addedCount;
};

export const getVocabulary = async (
    level: Level, 
    category: VocabCategory, 
    vocabType: VocabType | 'all', 
    posFilter: PartOfSpeech | 'all', 
    sortOrder: SortOrder, 
    count: number,
    frequencyLevel?: number
): Promise<VocabDBItem[]> => {
    const db = await getDb();
    let allItems: VocabDBItem[] = [];

    if (vocabType === 'word' || vocabType === 'all') {
        const words = await db.getAllFromIndex(WORDS_STORE_NAME, 'level_category', IDBKeyRange.only([level, category]));
        allItems.push(...words);
    }
    if (vocabType === 'idiom' || vocabType === 'all') {
        const idioms = await db.getAllFromIndex(IDIOMS_STORE_NAME, 'level_category', IDBKeyRange.only([level, category]));
        allItems.push(...idioms);
    }

    if (posFilter !== 'all') {
        allItems = allItems.filter(item => item.pos === posFilter);
    }
    
    if (frequencyLevel) {
        allItems = allItems.filter(item => item.frequencyLevel === frequencyLevel);
    }
    
    if (sortOrder === 'Alphabetical') {
        allItems.sort((a, b) => a.english.localeCompare(b.english));
    } else {
        // Shuffle for Random order
        for (let i = allItems.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [allItems[i], allItems[j]] = [allItems[j], allItems[i]];
        }
    }

    return allItems.slice(0, count);
};


export const getAllVocabularyForLevelAndCategory = async (
    level: Level, 
    category: VocabCategory, 
    vocabType: VocabType | 'all', 
    posFilter: PartOfSpeech | 'all', 
    sortOrder: SortOrder,
    frequencyLevel?: number
): Promise<VocabDBItem[]> => {
    const db = await getDb();
    let allItems: VocabDBItem[] = [];

    if (vocabType === 'word' || vocabType === 'all') {
        const words = await db.getAllFromIndex(WORDS_STORE_NAME, 'level_category', IDBKeyRange.only([level, category]));
        allItems.push(...words);
    }
    if (vocabType === 'idiom' || vocabType === 'all') {
        const idioms = await db.getAllFromIndex(IDIOMS_STORE_NAME, 'level_category', IDBKeyRange.only([level, category]));
        allItems.push(...idioms);
    }

    if (posFilter !== 'all') {
        allItems = allItems.filter(item => item.pos === posFilter);
    }
    
    if (frequencyLevel) {
        allItems = allItems.filter(item => item.frequencyLevel === frequencyLevel);
    }
    
    if (sortOrder === 'Alphabetical') {
        allItems.sort((a, b) => a.english.localeCompare(b.english));
    } else {
        // Shuffle for Random order
        for (let i = allItems.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [allItems[i], allItems[j]] = [allItems[j], allItems[i]];
        }
    }

    return allItems;
};

export const getVocabCount = async (): Promise<number> => {
    const db = await getDb();
    const wordCount = await db.count(WORDS_STORE_NAME);
    const idiomCount = await db.count(IDIOMS_STORE_NAME);
    return wordCount + idiomCount;
}

export const getExistingWords = async (level: Level | typeof ALL_LEVELS, category: VocabCategory | typeof ALL_CATEGORIES, type: VocabType | 'all', limit: number): Promise<string[]> => {
    const db = await getDb();
    let items: VocabDBItem[] = [];

    if (type === 'word' || type === 'all') {
        const words = await db.getAll(WORDS_STORE_NAME);
        items.push(...words);
    }
    if (type === 'idiom' || type === 'all') {
        const idioms = await db.getAll(IDIOMS_STORE_NAME);
        items.push(...idioms);
    }

    if (level !== ALL_LEVELS) {
        items = items.filter(item => item.level === level);
    }
    if (category !== ALL_CATEGORIES) {
        items = items.filter(item => item.category === category);
    }
    
    const shuffled = items.sort(() => 0.5 - Math.random());
    return shuffled.slice(0, limit).map(item => item.type === 'word' && item.pos ? `${item.english}-${item.pos}` : item.english);
}

export const getPaginatedVocabulary = async (
    page: number, 
    itemsPerPage: number, 
    filters: { 
        level?: Level; 
        category?: VocabCategory; 
        type?: VocabType; 
        search?: string; 
        sortOrder?: 'default' | 'alphabetical';
        frequencyLevel?: number;
    }
): Promise<{ items: VocabDBItem[], total: number }> => {
    const db = await getDb();
    const lowerCaseSearch = filters.search?.toLowerCase();

    const matches = (item: VocabDBItem) => {
        if (filters.level && item.level !== filters.level) return false;
        if (filters.category && item.category !== filters.category) return false;
        if (filters.type && item.type !== filters.type) return false;
        if (filters.frequencyLevel && item.frequencyLevel !== filters.frequencyLevel) return false;
        if (lowerCaseSearch && !item.english.toLowerCase().includes(lowerCaseSearch) && !item.japanese.toLowerCase().includes(lowerCaseSearch)) return false;
        return true;
    }
    
    let allMatchingItems: VocabDBItem[] = [];
    if (filters.type !== 'idiom') {
        const words = await db.getAll(WORDS_STORE_NAME);
        allMatchingItems.push(...words.filter(matches));
    }
     if (filters.type !== 'word') {
        const idioms = await db.getAll(IDIOMS_STORE_NAME);
        allMatchingItems.push(...idioms.filter(matches));
    }
    
    if (filters.sortOrder === 'alphabetical') {
        allMatchingItems.sort((a, b) => a.english.localeCompare(b.english));
    } else {
        allMatchingItems.sort((a, b) => (a.id ?? 0) - (b.id ?? 0));
    }

    const total = allMatchingItems.length;
    const start = (page - 1) * itemsPerPage;
    const items = allMatchingItems.slice(start, start + itemsPerPage);

    return { items, total };
};


export const getAllVocabulary = async (): Promise<VocabDBItem[]> => {
    const db = await getDb();
    const words = await db.getAll(WORDS_STORE_NAME);
    const idioms = await db.getAll(IDIOMS_STORE_NAME);
    return [...words, ...idioms];
}

export const clearDatabase = async (): Promise<void> => {
    const db = await getDb();
    await db.clear(WORDS_STORE_NAME);
    await db.clear(IDIOMS_STORE_NAME);
    console.log("Database cleared.");
}

export const getItemsWithoutFrequency = async (): Promise<VocabDBItem[]> => {
    const db = await getDb();
    const words = await db.getAll(WORDS_STORE_NAME);
    const idioms = await db.getAll(IDIOMS_STORE_NAME);
    return [...words, ...idioms].filter(item => item.frequencyLevel === undefined);
};

export const updateFrequencyLevels = async (updates: { id: number; type: VocabType; frequencyLevel: number }[]): Promise<void> => {
    const db = await getDb();
    const tx = db.transaction([WORDS_STORE_NAME, IDIOMS_STORE_NAME], 'readwrite');
    const wordsStore = tx.objectStore(WORDS_STORE_NAME);
    const idiomsStore = tx.objectStore(IDIOMS_STORE_NAME);

    await Promise.all(updates.map(async (update) => {
        const store = update.type === 'word' ? wordsStore : idiomsStore;
        const item = await store.get(update.id);
        if (item) {
            item.frequencyLevel = update.frequencyLevel;
            await store.put(item);
        }
    }));
    
    await tx.done;
};
