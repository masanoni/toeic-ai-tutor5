
import { GoogleGenAI } from "@google/genai";
import { 
    ReadingPassage, Level, VocabCategory, VocabType, VocabDBItem, PartOfSpeech,
    ListeningExercise, ListeningPart, IncompleteSentenceExercise, TextCompletionExercise,
    GrammarQuizQuestion,
    GrammarCheckResult
} from '../types';
import { VOCAB_CATEGORIES, LEVELS, ALL_LEVELS, ALL_CATEGORIES, PARTS_OF_SPEECH, GRAMMAR_TOPICS } from "../constants";


if (!process.env.API_KEY) {
    throw new Error("API_KEY environment variable not set");
}

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const parseJsonResponse = <T,>(text: string): T | null => {
    let jsonStr = text.trim();
    const fenceRegex = /^```(?:json)?\s*\n?(.*?)\n?\s*```$/s;
    const match = jsonStr.match(fenceRegex);
    if (match && match[2]) {
        jsonStr = match[2].trim();
    }
    try {
        return JSON.parse(jsonStr) as T;
    } catch (e) {
        console.error("Failed to parse JSON response:", e, "Raw text:", `"${text}"`);
        // Attempt to fix common errors and retry
        try {
            let fixedJsonStr = jsonStr.replace(/,\s*([}\]])/g, '$1'); // Remove trailing commas
            return JSON.parse(fixedJsonStr) as T;
        } catch (e2) {
            console.error("Failed to parse even after fixing trailing commas.", e2);
            return null;
        }
    }
};

const systemInstruction = `You are a machine that returns only raw, valid JSON.
- Your entire response must be a single JSON object or array.
- Do not add any text before or after the JSON.
- Do not use markdown (e.g., \`\`\`json).
- Do not add comments.
- Do not leave trailing commas.
- Ensure all strings are properly quoted and terminated.`;

type AIResponseItem = Partial<Pick<VocabDBItem, 'english' | 'japanese' | 'pos' | 'example_en' | 'example_jp' | 'level' | 'category' | 'type'>>;

export const generateVocabulary = async (
    level: Level | typeof ALL_LEVELS, 
    category: VocabCategory | typeof ALL_CATEGORIES, 
    type: VocabType | 'all', 
    existingWords: string[]
): Promise<AIResponseItem[] | null> => {
    
    let prompt = `Generate a JSON array of 75 unique TOEIC vocabulary items.\n`;
    prompt += `The vocabulary should be sourced from a diverse range of contexts, including recent news, business articles, academic texts, and topics commonly found in past TOEIC tests.\n`;
    prompt += `Prioritize less common, more specific vocabulary suitable for the TOEIC test. Avoid overly basic or common words.\n`;

    const keysToInclude = ['"english"', '"japanese"', '"example_en"', '"example_jp"'];

    if (level === ALL_LEVELS) {
        keysToInclude.push('"level"');
        prompt += `The items should span various difficulty levels. For each item, you MUST include a "level" key with one of these exact string values: ["${LEVELS.join('", "')}"].\n`;
    } else {
        prompt += `The items MUST be for a '${level}' learner.\n`;
    }

    if (category === ALL_CATEGORIES) {
        keysToInclude.push('"category"');
        prompt += `The items should cover various topics. For each item, you MUST include a "category" key with one of these exact string values: ["${VOCAB_CATEGORIES.join('", "')}"].\n`;
    } else {
        prompt += `The items MUST be related to the category '${category}'.\n`;
    }
    
    if (type === 'all') {
        keysToInclude.push('"type"');
        prompt += `The items should be a mix of words and idioms. For each item, you MUST include a "type" key with one of these values: "word", "idiom".\n`;
        prompt += `If the type is "word", you MUST include a "pos" key with one of these values: ["${PARTS_OF_SPEECH.join('", "')}"]. If the type is "idiom", do not include the "pos" key.\n`;
        keysToInclude.push('"pos"');
        prompt += `The combination of "english" and "pos" for words, and "english" for idioms must be unique. Do not include any of the following existing items:\n${JSON.stringify(existingWords)}\n`;
    } else if (type === 'word') {
        keysToInclude.push('"pos"');
        prompt += `All items must be of type 'word'.\n`;
        prompt += `For each item, you MUST include a "pos" key with one of these exact string values: ["${PARTS_OF_SPEECH.join('", "')}"].\n`;
        prompt += `The combination of the "english" and "pos" values must be unique. DO NOT include any of the following "english-pos" combinations:\n${JSON.stringify(existingWords)}\n`;
    } else { // idiom
        prompt += `All items must be of type 'idiom'.\n`;
        prompt += `The "english" value for each object must be unique. DO NOT include any of the following existing phrases:\n${JSON.stringify(existingWords)}\n`;
    }

    prompt += `Each object in the array MUST have exactly these keys: ${[...new Set(keysToInclude)].join(', ')}. For idioms, "pos" should be omitted.\n`;
    prompt += `\nThe output MUST be a single, raw, valid JSON array. It must start with '[' and end with ']'. ABSOLUTELY NO other text, characters, comments, or markdown should be included in the response.`;

    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash-preview-04-17",
            contents: prompt,
            config: {
                systemInstruction,
                responseMimeType: "application/json",
            },
        });
        
        return parseJsonResponse<AIResponseItem[]>(response.text);
    } catch (error) {
        console.error("Error generating vocabulary:", error);
        return null;
    }
};


export const generateReadingPassage = async (level: Level, category: VocabCategory): Promise<ReadingPassage | null> => {
    const prompt = `
      Generate a JSON object for a TOEIC Part 7 style reading exercise for a '${level}' learner. The topic MUST be related to '${category}'.
      The JSON object must have exactly four keys: "passage", "idioms", "questions", "key_sentence_indices".
      1. "passage": An array of objects. Each object must have "english" and "japanese" string keys, representing one sentence and its translation. The passage should be about 150-200 words long.
      2. "idioms": An array of 2-3 objects, where each object has "english" and "japanese" string keys for idioms or key vocabulary found in the passage.
      3. "questions": An array of 2-4 objects. Each object represents a multiple-choice comprehension question based on the passage and must have these keys: "question" (string), "options" (array of 4 strings), "correctOptionIndex" (number from 0-3), and "explanation" (string).
      4. "key_sentence_indices": An array of numbers, representing the 0-based indices of the 2-3 most important sentences in the "passage" array.
      The output MUST be a single, raw, valid JSON object.
    `;

    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash-preview-04-17",
            contents: prompt,
            config: { systemInstruction, responseMimeType: "application/json" },
        });
        
        return parseJsonResponse<ReadingPassage>(response.text);
    } catch (error) {
        console.error("Error generating reading passage:", error);
        return null;
    }
};

export const generateListeningExercise = async (part: ListeningPart, level: Level, category: VocabCategory): Promise<ListeningExercise | null> => {
    let prompt;

    switch (part) {
        case ListeningPart.Part2:
            prompt = `
              Generate a JSON object for a TOEIC Listening Part 2 (Question-Response) exercise for a '${level}' learner.
              The JSON object must have exactly these keys: "part", "question", "options", "correctOptionIndex", "explanation".
              1. "part": The string value "${ListeningPart.Part2}".
              2. "question": A single, short question or statement, as would be heard in the test (e.g., "When is the deadline for the report?").
              3. "options": An array of exactly 3 short string responses. One is the correct response, the other two are plausible but incorrect distractors.
              4. "correctOptionIndex": A number from 0 to 2, representing the index of the correct response in the "options" array.
              5. "explanation": A concise explanation of why the correct option is the best response.
              The output MUST be a single, raw, valid JSON object.
            `;
            break;
        case ListeningPart.Part3:
            prompt = `
              Generate a JSON object for a TOEIC Listening Part 3 (Conversation) exercise for a '${level}' learner on the topic of '${category}'.
              The JSON object must have exactly these keys: "part", "title", "passage", "question", "options", "correctOptionIndex", "explanation".
              1. "part": The string value "${ListeningPart.Part3}".
              2. "title": A short title (e.g., "Discussing a Project Delay").
              3. "passage": An array of objects representing a conversation between two or three people. Each object must have "english" and "japanese" string keys. The total length should be 4-8 turns.
              4. "question": A comprehension question based on the conversation.
              5. "options": An array of exactly 4 objects. Each object MUST have "en" (English) and "jp" (Japanese translation) keys.
              6. "correctOptionIndex": The 0-based index of the correct option.
              7. "explanation": A concise explanation.
              The output MUST be a single, raw, valid JSON object.
            `;
            break;
        case ListeningPart.Part4:
            prompt = `
              Generate a JSON object for a TOEIC Listening Part 4 (Short Talk) exercise for a '${level}' learner on the topic of '${category}'.
              The JSON object must have exactly these keys: "part", "title", "passage", "question", "options", "correctOptionIndex", "explanation".
              1. "part": The string value "${ListeningPart.Part4}".
              2. "title": A short title (e.g., "Weather Forecast" or "Museum Announcement").
              3. "passage": An array of objects representing a short talk by a single speaker. Each object must have "english" and "japanese" string keys. Total length about 100-150 words.
              4. "question": A comprehension question based on the talk.
              5. "options": An array of exactly 4 objects. Each object MUST have "en" (English) and "jp" (Japanese translation) keys.
              6. "correctOptionIndex": The 0-based index of the correct option.
              7. "explanation": A concise explanation.
              The output MUST be a single, raw, valid JSON object.
            `;
            break;
    }
    
    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash-preview-04-17",
            contents: prompt,
            config: { systemInstruction, responseMimeType: "application/json" },
        });
        
        return parseJsonResponse<ListeningExercise>(response.text);
    } catch (error) {
        console.error(`Error generating listening exercise for ${part}:`, error);
        return null;
    }
};


export const generateIncompleteSentenceExercise = async (level: Level, category: VocabCategory): Promise<IncompleteSentenceExercise | null> => {
    const prompt = `
      Generate a JSON object for a TOEIC Part 5 (Incomplete Sentence) exercise for a '${level}' learner. The topic should be related to '${category}'.
      The JSON object must have exactly these keys: "sentence_with_blank", "options", "correctOptionIndex", "explanation_jp".
      1. "sentence_with_blank": A single sentence with a missing word or phrase, indicated by "____".
      2. "options": An array of exactly 4 strings. One correctly fills the blank, the others are common distractors (e.g., wrong tense, wrong part of speech).
      3. "correctOptionIndex": A number from 0 to 3, for the correct option.
      4. "explanation_jp": A concise grammar or vocabulary explanation for the correct answer, written in Japanese.
      The output MUST be a single, raw, valid JSON object.
    `;
    
    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash-preview-04-17",
            contents: prompt,
            config: { systemInstruction, responseMimeType: "application/json" },
        });
        
        return parseJsonResponse<IncompleteSentenceExercise>(response.text);
    } catch (error) {
        console.error("Error generating incomplete sentence exercise:", error);
        return null;
    }
};

export const generateTextCompletionExercise = async (level: Level, category: VocabCategory): Promise<TextCompletionExercise | null> => {
    const prompt = `
      Generate a JSON object for a TOEIC Part 6 (Text Completion) exercise for a '${level}' learner. The topic should be related to '${category}'.
      The JSON object must have exactly these keys: "passage", "questions".
      1. "passage": A single string of text (e.g., an email, notice, or article) containing exactly 4 numbered blanks, like "[1]", "[2]", "[3]", and "[4]".
      2. "questions": An array of exactly 4 objects, one for each blank. Each object must have these keys: "blank_number" (1-4), "options" (array of 4 strings), "correctOptionIndex" (0-3), and "explanation_jp". The explanation must be in Japanese.
      The output MUST be a single, raw, valid JSON object. Ensure the 'questions' array has exactly 4 items.
    `;

    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash-preview-04-17",
            contents: prompt,
            config: { systemInstruction, responseMimeType: "application/json" },
        });
        
        return parseJsonResponse<TextCompletionExercise>(response.text);
    } catch (error) {
        console.error("Error generating text completion exercise:", error);
        return null;
    }
};

export const generateGrammarExplanation = async (topic: string): Promise<string | null> => {
    const prompt = `
      「${topic}」に関する英語の文法ルールを、英語を久しぶりに再学習する日本人向けに、非常に分かりやすく詳しく解説してください。
      初心者がつまずきやすいポイント、基本的な使い方、応用的な使い方、よくある間違いや例外的な用法なども含めて、豊富な例文（英語と日本語訳を併記）を交えながら説明してください。
      応答は、マークダウン形式ではなく、改行を活かしたプレーンテキストで、人間が読みやすいように整形してください。
    `;
    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash-preview-04-17",
            contents: prompt,
        });
        return response.text;
    } catch (error) {
        console.error(`Error generating grammar explanation for ${topic}:`, error);
        return null;
    }
};

export const generateGrammarQuiz = async (
    topics: string[], 
    explanation?: string, 
    level?: Level
): Promise<GrammarQuizQuestion[] | null> => {
    let prompt;
    const questionCount = explanation ? 5 : 50;

    if (explanation && topics.length === 1) {
      // Learning mode: quiz based on a specific explanation for one topic
      const topic = topics[0];
      prompt = `
        以下の文法解説を元に、学習者の理解度を確認するためのTOEIC Part 5形式の選択問題を${questionCount}問生成してください。
        解説のトピック: 「${topic}」

        ---
        ${explanation.substring(0, 2000)}
        ---

        問題は「${topic}」の知識を問うものにしてください。JSONオブジェクトの配列として、以下のキーを持つオブジェクトを${questionCount}個生成してください:
        - "question_jp": 問題の指示や文脈を日本語で記述 (例: 「空欄に最も適切な単語を選びなさい。」)
        - "sentence_with_blank": "____" を含む、空欄付きの英文
        - "options": 4つの選択肢の配列
        - "correctOptionIndex": 0から3の正解のインデックス番号
        - "explanation_jp": 正解の選択肢がなぜ正しいか、他の選択肢がなぜ間違いかを日本語で簡潔に解説

        The output MUST be a single, raw, valid JSON array.
      `;
    } else {
      // Practice mode: quiz based on one or more selected topics
      const topicList = topics.join('\n- ');
      prompt = `
        TOEIC Part 5形式の文法選択問題を${questionCount}問、生成してください。
        ${level ? `問題の難易度は「${level}」レベルに調整してください。` : ''}

        問題は、以下の基本的な英文法のトピックからランダムに組み合わせて出題してください:
        - ${topicList}

        JSONオブジェクトの配列として、以下のキーを持つオブジェクトを${questionCount}個生成してください:
        - "question_jp": 問題の指示や文脈を日本語で記述 (例: 「空欄に最も適切な単語を選びなさい。」)
        - "sentence_with_blank": "____" を含む、空欄付きの英文
        - "options": 4つの選択肢の配列
        - "correctOptionIndex": 0から3の正解のインデックス番号
        - "explanation_jp": 正解の選択肢がなぜ正しいか、他の選択肢がなぜ間違いかを日本語で簡潔に解説

        The output MUST be a single, raw, valid JSON array.
      `;
    }

    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash-preview-04-17",
            contents: prompt,
            config: { systemInstruction, responseMimeType: "application/json" },
        });
        return parseJsonResponse<GrammarQuizQuestion[]>(response.text);
    } catch (error) {
        console.error(`Error generating grammar quiz for topics ${topics.join(', ')}:`, error);
        return null;
    }
};

export const checkGrammar = async (sentence: string): Promise<GrammarCheckResult | null> => {
    const prompt = `
        You are an expert English grammar checker for Japanese learners.
        Analyze the following English sentence for any grammatical errors, awkward phrasing, or typos.
        Provide a corrected version of the sentence and a concise, easy-to-understand explanation in Japanese.

        The user's sentence is: "${sentence}"

        If the sentence is already grammatically perfect and natural, the "correctedSentence" should be the same as the original, and the "explanation_jp" should simply state that the sentence is correct (e.g., "この文は文法的に正しく、自然です。").

        The JSON object must have exactly these three keys:
        1. "originalSentence": The original sentence provided by the user.
        2. "correctedSentence": The corrected, natural-sounding English sentence.
        3. "explanation_jp": The explanation of the corrections in Japanese.

        The output MUST be a single, raw, valid JSON object.
    `;

    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash-preview-04-17",
            contents: prompt,
            config: { systemInstruction, responseMimeType: "application/json" },
        });
        
        return parseJsonResponse<GrammarCheckResult>(response.text);
    } catch (error) {
        console.error("Error generating grammar check:", error);
        return null;
    }
};


export const assignFrequencyLevels = async (items: { id: number, type: VocabType, english: string }[]): Promise<{ id: number; type: VocabType; frequencyLevel: number }[] | null> => {
    const prompt = `
        You are an expert TOEIC test analyst. I will provide you with a list of English words and idioms.
        For each item, classify its frequency of appearance on the TOEIC test into one of three levels: "High", "Medium", or "Low".
        - "High": Very common, essential vocabulary. Appears frequently.
        - "Medium": Appears regularly, good to know for a solid score.
        - "Low": Less common, but could appear in higher-level questions. Important for advanced scores.
        
        The list of items to classify is:
        ${JSON.stringify(items)}

        Your response MUST be a single, raw, valid JSON array. Each object in the array must correspond to an item in the input list and MUST have exactly these three keys:
        1. "id": The original integer ID of the item.
        2. "type": The original type of the item ("word" or "idiom").
        3. "frequency": Your classification as a string ("High", "Medium", or "Low").
    `;

    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash-preview-04-17",
            contents: prompt,
            config: { systemInstruction, responseMimeType: "application/json" },
        });

        const results = parseJsonResponse<{ id: number, type: VocabType, frequency: 'High' | 'Medium' | 'Low' }[]>(response.text);

        if (!results) {
            console.error("AI returned null or unparsable response for frequency levels.");
            return null;
        }
        
        const levelMap: { [key in 'High' | 'Medium' | 'Low']: number } = {
            'High': 3,
            'Medium': 2,
            'Low': 1,
        };

        return results.map(result => ({
            id: result.id,
            type: result.type,
            frequencyLevel: levelMap[result.frequency] || 2, // Default to medium if AI returns an invalid string
        }));

    } catch (error) {
        console.error("Error assigning frequency levels:", error);
        return null;
    }
};