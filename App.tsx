import React, {useCallback, useEffect, useRef, useState} from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import EventSource from 'react-native-sse';
import Tts from 'react-native-tts';
import Icon from 'react-native-vector-icons/Feather';
import Vosk from 'react-native-vosk';
import {API_KEY, API_URL, MODEL} from '@env';

console.log('API_KEY', API_KEY);
console.log('API_URL', API_URL);
console.log('MODEL', MODEL);

type TTSVoiceType = {id: string; name: string; language: string};

const App: React.FC = () => {



  const [voices, setVoices] = useState<TTSVoiceType[]>([]);
  const [ttsStatus, setTtsStatus] = useState<string>('initializing');
  const [selectedVoice, setSelectedVoice] = useState<string | null>(null);
  const [text, setText] = useState<string>('');
  const [llmInput, setLlmInput] = useState<string>(
    'Explain quantum computing in simple terms in 5 paragraph',
  );

  const [_, setReady] = useState<boolean>(false);
  const [recognizing, setRecognizing] = useState<boolean>(false);
  const [result, setResult] = useState<string | undefined>();
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  const vosk = useRef(new Vosk()).current;

  const loadVosk = useCallback(() => {
    vosk
      .loadModel('model-en-us')
      .then(() => setReady(true))
      .catch((e: Error) => console.error(e));
  }, [vosk]);

  const unloadVosk = useCallback(() => {
    vosk.unload();
    setReady(false);
    setRecognizing(false);
  }, [vosk]);

  useEffect(() => {
    const initTts = async () => {
      const resultTTS = await Tts.getInitStatus();
      console.log('TTS init status: ' + resultTTS);
      if (resultTTS === 'success') {
        const availableVoices = await Tts.voices();
        const englishVoices = availableVoices
          .filter(v => v.language.includes('en'))
          .map(v => ({id: v.id, name: v.name, language: v.language}));

        setVoices(englishVoices);

        if (englishVoices.length > 0) {
          const defaultVoice = englishVoices[0];
          setSelectedVoice(defaultVoice.id);
          await Tts.setDefaultLanguage(defaultVoice.language);
          await Tts.setDefaultVoice(defaultVoice.id);
        }

        // Add event listeners
        Tts.addEventListener('tts-start', () => setIsSpeaking(true));
        Tts.addEventListener('tts-finish', () => setIsSpeaking(false));
        Tts.addEventListener('tts-cancel', () => setIsSpeaking(false));

        setTtsStatus('initialized');
      } else {
        setTtsStatus('failed');
      }
    };

    initTts();
    loadVosk(); // Auto-load the Vosk model

    const partialResultEvent = vosk.onPartialResult((res: string) => {
      setResult(res);
    });

    const finalResultEvent = vosk.onResult(async (res: string) => {
      try {
        setResult(res);
        setLlmInput(res);
        await stopRecording();
        await sendToLLM(res);
      } catch (e) {
        console.error(e);
      }
    });

    const errorEvent = vosk.onError((e: Error) => {
      console.error(e);
    });

    const timeoutEvent = vosk.onTimeout(() => {
      console.log('Recognizer timed out');
      setRecognizing(false);
    });

    // Cleanup function
    return () => {
      Tts.removeAllListeners('tts-start');
      Tts.removeAllListeners('tts-finish');
      Tts.removeAllListeners('tts-cancel');
      partialResultEvent.remove();
      finalResultEvent.remove();
      errorEvent.remove();
      timeoutEvent.remove();
      unloadVosk();
    };
  }, [vosk, loadVosk, unloadVosk]);

  const stop = useCallback(() => {
    Tts.stop();
    setIsSpeaking(false);
    setText('');
  }, []);

  const onVoicePress = useCallback(async (voice: TTSVoiceType) => {
    try {
      await Tts.setDefaultLanguage(voice.language);
      await Tts.setDefaultVoice(voice.id);
      setSelectedVoice(voice.id);
    } catch (err) {
      console.log(`setDefaultVoice error `, err);
    }
  }, []);

  const sendToLLM = async (prompt: string) => {
    console.log('Sending to LLM: ' + prompt);
    setIsProcessing(true);
    const payload = {
      model: MODEL,
      max_tokens: 256,
      stream: true,
      messages: [
        {
          role: 'system',
          content:
            'You are a helpful assistant that can answer questions and help with tasks. Be concise and to the point. Single paragraph response.',
        },
        {role: 'user', content: prompt},
      ],
    };

    const es = new EventSource(API_URL || '', {
      headers: {
        Authorization: `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
      },
      method: 'POST',
      body: JSON.stringify(payload),
    });

    let fullText = '';
    let streamAudio = false;
    const listener = (event: any) => {
      if (event.type === 'open') {
        console.log('Open SSE connection.');
      } else if (event.type === 'message') {
        if (event.data !== '[DONE]') {
          const data = JSON.parse(event.data);
          const delta = data.choices[0].delta;
          const finishReason = data.choices[0].finish_reason;

          if (finishReason === 'stop') {
            es.close();
          } else {
            if (delta?.content) {
              fullText += delta.content;
              setText(prevText => prevText + delta.content);
              if (streamAudio) {
                Tts.speak(delta.content);
              } else if (fullText.split(/\s+/).length > 5) {
                Tts.speak(fullText);
                streamAudio = true;
              }
            }
          }
        } else {
          setIsProcessing(false);
          console.log('Done. SSE connection closed.');
          es.close();
        }
      } else if (event.type === 'error') {
        console.error('Connection error:', event.message);
      } else if (event.type === 'exception') {
        console.error('Error:', event.message, event.error);
      }
    };

    es.addEventListener('open', listener);
    es.addEventListener('message', listener);
    es.addEventListener('error', listener);

    return () => {
      es.removeAllEventListeners();
      es.close();
      setIsProcessing(false);
    };
  };

  const startRecording = async () => {
    if (isSpeaking) {
      stop();
    }
    try {
      await vosk.start({timeout: 60000});
      setRecognizing(true);
    } catch (e) {
      console.error(e);
    }
  };

  const stopRecording = async () => {
    try {
      await vosk.stop();
      setRecognizing(false);
    } catch (e) {
      console.error(e);
    }
  };

  const handleMicPress = () => {
    if (recognizing) {
      stopRecording();
    } else if (isSpeaking) {
      stop();
    } else {
      setText('');
      setLlmInput('');
      startRecording();
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>React Native TTS Example</Text>
      <Text style={styles.label}>{`Status: ${ttsStatus}`}</Text>

      <TextInput
        style={styles.textInput}
        multiline={true}
        onChangeText={setText}
        value={text}
      />

      <TextInput
        style={styles.llmInput}
        placeholder="Press the microphone to start recording"
        onChangeText={setLlmInput}
        value={llmInput}
      />

      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={[
            styles.micButton,
            recognizing && styles.recordingButton,
            isSpeaking && styles.speakingButton,
          ]}
          onPress={handleMicPress}>
          <Text style={styles.buttonText}>
            {recognizing ? (
              <Icon name="mic" size={50} />
            ) : isSpeaking ? (
              <Icon name="volume-2" size={50} />
            ) : isProcessing ? (
              <Icon name="loader" size={50} />
            ) : (
              <Icon name="mic" size={50} />
            )}
          </Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.resultText}>Recognized text:</Text>
      <Text style={styles.resultContent}>{result}</Text>

      <Text style={styles.voiceSelectionTitle}>Available Voices:</Text>
      {voices.map(voice => (
        <TouchableOpacity
          key={voice.id}
          style={[
            styles.voiceItem,
            selectedVoice === voice.id && styles.selectedVoiceItem,
          ]}
          onPress={() => onVoicePress(voice)}>
          <Text style={styles.voiceItemText}>{`${voice.language} - ${
            voice.name || voice.id
          }`}</Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
};
const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    color: '#333',
  },
  label: {
    textAlign: 'center',
    marginBottom: 10,
    fontSize: 16,
    color: '#666',
  },
  textInput: {
    borderColor: '#ccc',
    borderWidth: 1,
    borderRadius: 5,
    width: '100%',
    height: 300,
    marginBottom: 20,
    padding: 10,
    fontSize: 16,
  },
  llmInput: {
    borderColor: '#ccc',
    borderWidth: 1,
    borderRadius: 5,
    width: '100%',
    height: 40,
    marginBottom: 20,
    padding: 10,
    fontSize: 16,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    width: '100%',
    marginBottom: 20,
  },
  micButton: {
    padding: 15,
    borderRadius: 50,
    width: 100,
    height: 100,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#007AFF',
  },
  recordingButton: {
    backgroundColor: '#FF3B30',
  },
  speakingButton: {
    backgroundColor: '#4CD964',
  },
  buttonText: {
    color: '#fff',
    fontSize: 50,
    fontWeight: 'bold',
  },
  resultText: {
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 20,
    color: '#333',
  },
  resultContent: {
    fontSize: 16,
    color: '#666',
  },
  voiceSelectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 20,
    color: '#333',
  },
  voiceItem: {
    padding: 10,
    borderRadius: 5,
    marginBottom: 10,
    width: '100%',
    backgroundColor: '#f0f0f0',
  },
  selectedVoiceItem: {
    backgroundColor: '#d0d0d0',
  },
  voiceItemText: {
    fontSize: 16,
    color: '#333',
  },
});

export default App;
