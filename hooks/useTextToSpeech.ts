
import { useState, useEffect, useCallback, useRef } from 'react';

// Custom error to distinguish intentional cancellation from other errors.
export class SpeechCancellationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SpeechCancellationError';
  }
}

export const useTextToSpeech = () => {
    const [isSpeaking, setIsSpeaking] = useState(false);
    const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

    // Eagerly load voices
    useEffect(() => {
        if (typeof window !== 'undefined' && window.speechSynthesis) {
            window.speechSynthesis.getVoices();
        }
    }, []);
    
    // Cleanup function to stop speech when the component unmounts
    useEffect(() => {
        return () => {
            if (typeof window !== 'undefined' && window.speechSynthesis) {
                // Remove reference to avoid memory leaks
                if (utteranceRef.current) {
                    utteranceRef.current.onend = null;
                    utteranceRef.current.onerror = null;
                    utteranceRef.current.onstart = null;
                }
                window.speechSynthesis.cancel();
            }
        };
    }, []);

    const speak = useCallback((text: string, lang: 'en-US' | 'ja-JP'): Promise<void> => {
        return new Promise((resolve, reject) => {
            if (!text || typeof window === 'undefined' || !window.speechSynthesis) {
                return resolve();
            }

            const speakLogic = () => {
                const allVoices = window.speechSynthesis.getVoices();
                let voice: SpeechSynthesisVoice | undefined;
                const langPrefix = lang.split('-')[0];

                // Prioritize specific, high-quality voices if available (especially for iOS)
                if (lang === 'en-US') {
                    voice = allVoices.find(v => v.name === 'Samantha' && v.lang === 'en-US');
                }

                if (!voice) {
                    voice = allVoices.find(v => v.lang === lang);
                }
                if (!voice) {
                    voice = allVoices.find(v => v.lang.startsWith(langPrefix));
                }

                window.speechSynthesis.cancel(); 
                const utterance = new SpeechSynthesisUtterance(text);
                utteranceRef.current = utterance;
                utterance.lang = lang; 

                if (voice) {
                    utterance.voice = voice;
                } else {
                    console.warn(`No specific voice found for lang '${lang}'. Attempting to use browser default.`);
                }

                utterance.onstart = () => setIsSpeaking(true);
                
                utterance.onend = () => {
                    utteranceRef.current = null;
                    setIsSpeaking(false);
                    resolve();
                };

                utterance.onerror = (event) => {
                    utteranceRef.current = null;
                    setIsSpeaking(false);
                    if (event.error === 'canceled' || event.error === 'interrupted') {
                        reject(new SpeechCancellationError('Speech was cancelled'));
                    } else {
                        console.error('SpeechSynthesisUtterance.onerror', event);
                        reject(new Error(`Speech synthesis error: ${event.error}`));
                    }
                };

                window.speechSynthesis.speak(utterance);
            };

            const voices = window.speechSynthesis.getVoices();
            if (voices.length === 0 && 'onvoiceschanged' in window.speechSynthesis) {
                window.speechSynthesis.addEventListener('voiceschanged', speakLogic, { once: true });
            } else {
                speakLogic();
            }
        });
    }, []);

    const stop = useCallback(() => {
        if (typeof window !== 'undefined' && window.speechSynthesis) {
            window.speechSynthesis.cancel();
            setIsSpeaking(false);
        }
    }, []);

    return { speak, stop, isSpeaking };
};