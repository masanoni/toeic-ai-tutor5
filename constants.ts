import { Level, VocabCategory, ListeningPart, PartOfSpeech } from './types';

export const LEVELS = [Level.Beginner, Level.Intermediate, Level.Advanced];
export const VOCAB_CATEGORIES = [VocabCategory.Business, VocabCategory.Travel, VocabCategory.DailyLife, VocabCategory.Finance, VocabCategory.Health];
export const PARTS_OF_SPEECH = [PartOfSpeech.Noun, PartOfSpeech.Verb, PartOfSpeech.Adjective, PartOfSpeech.Adverb];


export const ALL_LEVELS = 'All Levels' as const;
export const ALL_CATEGORIES = 'All Categories' as const;

export const GENERATOR_LEVELS = [ALL_LEVELS, ...LEVELS];
export const GENERATOR_CATEGORIES = [ALL_CATEGORIES, ...VOCAB_CATEGORIES];

export const LISTENING_PARTS = [ListeningPart.Part2, ListeningPart.Part3, ListeningPart.Part4];

export const GRAMMAR_TOPICS = [
    '名詞 (Nouns)',
    '動詞 (Verbs)',
    '形容詞 (Adjectives)',
    '副詞 (Adverbs)',
    '前置詞 (Prepositions)',
    '冠詞 (Articles: a, an, the)',
    '現在形 (Present Tense)',
    '過去形 (Past Tense)',
    '未来形 (Future Tense)',
    '現在完了形 (Present Perfect)',
    '助動詞 (Auxiliary Verbs)',
    'SVO文型 (Sentence Structure)',
];