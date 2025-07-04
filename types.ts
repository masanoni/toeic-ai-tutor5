
export enum Screen {
  Home,
  Vocabulary,
  Reading,
  Drive,
  Listening,
  WordList,
  Part5,
  Part6,
  BasicGrammar,
  GrammarCheck,
}

export enum Level {
  Beginner = 'Beginner (TOEIC 400-600)',
  Intermediate = 'Intermediate (TOEIC 600-800)',
  Advanced = 'Advanced (TOEIC 800-990)',
}

export enum VocabCategory {
    Business = 'Business',
    Travel = 'Travel',
    DailyLife = 'Daily Life',
    Finance = 'Finance',
    Health = 'Health',
}

export type VocabType = 'word' | 'idiom';

export enum PartOfSpeech {
  Noun = 'Noun',
  Verb = 'Verb',
  Adjective = 'Adjective',
  Adverb = 'Adverb',
}

export type SortOrder = 'Random' | 'Alphabetical';

export interface VocabDBItem {
  id?: number;
  english: string;
  japanese: string;
  pos?: PartOfSpeech | null;
  example_en: string;
  example_jp: string;
  level: Level;
  category: VocabCategory;
  type: VocabType;
  frequencyLevel?: number; // 1: Low, 2: Medium, 3: High
}

export interface Sentence {
  english: string;
  japanese: string;
}

export interface ReadingQuestion {
  question: string;
  options: string[];
  correctOptionIndex: number;
  explanation: string;
}

export interface ReadingPassage {
  passage: Sentence[];
  idioms: {
    english: string;
    japanese: string;
  }[];
  questions: ReadingQuestion[];
  key_sentence_indices: number[];
}

// --- LISTENING ---
export enum ListeningPart {
    Part2 = 'Part 2: Question-Response',
    Part3 = 'Part 3: Conversation',
    Part4 = 'Part 4: Short Talk',
}

export interface QuestionResponseExercise {
    part: ListeningPart.Part2;
    question: string;
    options: string[];
    correctOptionIndex: number;
    explanation: string;
}

export interface ListeningPassage {
    passage: Sentence[];
    title: string;
}

export interface ListeningOption {
    en: string;
    jp: string;
}

export interface ListeningQuestion {
    question: string;
    options: ListeningOption[];
    correctOptionIndex: number;
    explanation: string;
}

export interface ConversationExercise extends ListeningPassage, ListeningQuestion {
    part: ListeningPart.Part3 | ListeningPart.Part4;
}

export type ListeningExercise = QuestionResponseExercise | ConversationExercise;


// --- GRAMMAR / READING ---

export interface IncompleteSentenceExercise {
    sentence_with_blank: string;
    options: string[];
    correctOptionIndex: number;
    explanation_jp: string;
}

export interface TextCompletionQuestion {
    blank_number: number;
    options: string[];
    correctOptionIndex: number;
    explanation_jp: string;
}

export interface TextCompletionExercise {
    passage: string; // Passage with numbered blanks like "[1]", "[2]"
    questions: TextCompletionQuestion[];
}

export interface GrammarQuizQuestion {
    question_jp: string;
    sentence_with_blank: string;
    options: string[];
    correctOptionIndex: number;
    explanation_jp: string;
}

export interface GrammarCheckResult {
    originalSentence: string;
    correctedSentence: string;
    explanation_jp: string;
}