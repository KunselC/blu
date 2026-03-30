import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export function useSpeechTranscription({
  active,
  recognitionLanguage = "en-US",
}) {
  const [transcript, setTranscript] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [error, setError] = useState("");
  const recognitionRef = useRef(null);

  const SpeechRecognition = useMemo(
    () => window.SpeechRecognition || window.webkitSpeechRecognition,
    [],
  );

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    setIsListening(false);
  }, []);

  const startListening = useCallback(() => {
    if (!SpeechRecognition) {
      setError("Speech recognition is not supported in this browser.");
      return;
    }

    setError("");
    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = recognitionLanguage;

    recognition.onresult = (event) => {
      let combinedText = "";
      for (let i = 0; i < event.results.length; i += 1) {
        combinedText += event.results[i][0].transcript;
      }
      setTranscript(combinedText.trim());
    };

    recognition.onerror = (event) => {
      setError(`Speech recognition error: ${event.error}`);
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
  }, [SpeechRecognition, recognitionLanguage]);

  const clearTranscript = useCallback(() => setTranscript(""), []);

  useEffect(() => {
    if (active) {
      startListening();
    } else {
      stopListening();
    }

    return () => {
      stopListening();
    };
  }, [active, startListening, stopListening]);

  return {
    transcript,
    setTranscript,
    isListening,
    error,
    clearTranscript,
    startListening,
    stopListening,
    supported: Boolean(SpeechRecognition),
  };
}
