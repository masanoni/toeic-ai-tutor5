
import { useState, useCallback } from 'react';

let audioContext: AudioContext | null = null;
let isUnlocked = false;

/**
 * Provides a function to unlock the Web Audio API, which is often
 * necessary on mobile browsers like Safari on iOS before any sound can be played.
 * This should be called from a user-initiated event, such as a click or tap.
 */
export const useAudioUnlock = () => {
    const [isAudioUnlocked, setIsAudioUnlocked] = useState(isUnlocked);

    const unlockAudio = useCallback(() => {
        if (isUnlocked || typeof window === 'undefined' || !((window as any).AudioContext || (window as any).webkitAudioContext)) {
            return;
        }

        if (!audioContext) {
            audioContext = new ((window as any).AudioContext || (window as any).webkitAudioContext)();
        }
        
        if (audioContext.state === 'suspended') {
            audioContext.resume();
        }
        
        // The rest of the unlock logic is often only needed once.
        if (isUnlocked) return;

        // Create a silent buffer.
        const buffer = audioContext.createBuffer(1, 1, 22050);
        const source = audioContext.createBufferSource();
        source.buffer = buffer;
        source.connect(audioContext.destination);

        // Play the silent sound.
        source.start(0);
        
        isUnlocked = true;
        setIsAudioUnlocked(true);
        console.log('AudioContext unlocked.');

    }, []);

    return { unlockAudio, isAudioUnlocked };
};
