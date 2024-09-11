import React, {useState, useEffect, useCallback, useRef} from 'react';
import {
  Button,
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Slider from '@react-native-community/slider';
import Tts from 'react-native-tts';
import EventSource from 'react-native-sse';

const bigText =
  "Hello, welcome to the TTS app! This innovative application harnesses the power of text-to-speech technology to bring your words to life. Whether you're a student looking to listen to study materials, a professional preparing for a presentation, or simply someone who enjoys having text read aloud, our app has you covered. With a wide range of voices and customizable speech settings, you can tailor the experience to your preferences. Explore the various features, adjust the speech rate and pitch, and discover how TTS can enhance your daily routine. Get ready to transform written words into spoken language with just a few taps!";

const API_URL = 'https://api.together.xyz/v1/chat/completions';
// const API_URL = 'https://api.openai.com/v1/chat/completions';
const API_KEY = '....';  // This is really for testing and POC, not for production
const MODEL = 'meta-llama/Meta-Llama-3.1-405B-Instruct-Turbo';
// const MODEL = 'gpt-4o';

const paragraphChunksGenerator = (text: string, wordsPerChunk: number) => {
  const words = text.split(/\s+/);
  const chunks = [];
  for (let i = 0; i < words.length; i += wordsPerChunk) {
    chunks.push(
      (i > 0 ? ' ' : '') + words.slice(i, i + wordsPerChunk).join(' '),
    );
  }
  return chunks;
};

type Voice = {id: string; name: string; language: string};

const App: React.FC = () => {
  const [voices, setVoices] = useState<Voice[]>([]);
  const [ttsStatus, setTtsStatus] = useState<string>('initializing');
  const [selectedVoice, setSelectedVoice] = useState<string | null>(null);
  const [speechRate, setSpeechRate] = useState<number>(0.5);
  const [speechPitch, setSpeechPitch] = useState<number>(1);
  const [text, setText] = useState<string>('');
  const [llmInput, setLlmInput] = useState<string>('Explain quantum computing in simple terms in 5 paragraph');
  const paragraphBuffer = useRef<string[]>(
    paragraphChunksGenerator(bigText, 1),
  );

  useEffect(() => {
    const initTts = async () => {
      const result = await Tts.getInitStatus();
      if (result === 'success') {
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

        await Tts.setDefaultRate(speechRate);
        await Tts.setDefaultPitch(speechPitch);

        // Add event listeners
        Tts.addEventListener('tts-start', event => console.log('start', event));
        Tts.addEventListener('tts-finish', event =>
          console.log('finish', event),
        );
        Tts.addEventListener('tts-cancel', event =>
          console.log('cancel', event),
        );
        Tts.addEventListener('tts-error', event => console.log('error', event));
        Tts.addEventListener('tts-progress', event =>
          console.log('progress', event),
        );

        setTtsStatus('initialized');
      } else {
        setTtsStatus('failed');
      }
    };

    initTts();

    // Cleanup function
    return () => {
      Tts.removeAllListeners('tts-start');
      Tts.removeAllListeners('tts-finish');
      Tts.removeAllListeners('tts-cancel');
      Tts.removeAllListeners('tts-progress');
      Tts.removeAllListeners('tts-error');
    };
  }, [speechRate, speechPitch]);

  const speak = async () => {
    for (const paragraph of paragraphBuffer.current) {
      Tts.speak(paragraph);
      setText(prevText => prevText + ' ' + paragraph);
      await new Promise(resolve => setTimeout(resolve, 200));
    }
  };

  const stop = useCallback(() => {
    Tts.stop();
    setText('');
  }, []);

  const setSpeechRateHandler = useCallback(async (rate: number) => {
    await Tts.setDefaultRate(rate);
    setSpeechRate(rate);
  }, []);

  const setSpeechPitchHandler = useCallback(async (pitch: number) => {
    await Tts.setDefaultPitch(pitch);
    setSpeechPitch(pitch);
  }, []);

  const onVoicePress = useCallback(async (voice: Voice) => {
    try {
      await Tts.setDefaultLanguage(voice.language);
      await Tts.setDefaultVoice(voice.id);
      setSelectedVoice(voice.id);
    } catch (err) {
      console.log(`setDefaultVoice error `, err);
    }
  }, []);

  const renderVoiceItem = useCallback(
    ({item}: {item: Voice}) => (
      <Button
        title={`${item.language} - ${item.name || item.id}`}
        color={selectedVoice === item.id ? undefined : '#969696'}
        onPress={() => onVoicePress(item)}
      />
    ),
    [selectedVoice, onVoicePress],
  );


  const sendToLLM = async () => {

    const payload = {
      model: MODEL,
      stream: true,
      messages: [{ role: 'user', content: llmInput }]
    };

    const es = new EventSource(API_URL, {
      headers: {
        Authorization: `Bearer ${API_KEY}`,
        'Content-Type': 'application/json'
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
              if(streamAudio) {
                Tts.speak(delta.content);
              } else if(fullText.split(/\s+/).length > 5) {
                Tts.speak(fullText);
                streamAudio = true;
              }
            }
          }
        } else {
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
    };
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>React Native TTS Example</Text>
      <Text style={styles.label}>{`Status: ${ttsStatus}`}</Text>

      <View style={styles.sliderContainer}>
        <Text style={styles.sliderLabel}>{`Speed: ${speechRate.toFixed(
          2,
        )}`}</Text>
        <Slider
          style={styles.slider}
          minimumValue={0.01}
          maximumValue={0.99}
          value={speechRate}
          onSlidingComplete={setSpeechRateHandler}
        />
      </View>

      <View style={styles.sliderContainer}>
        <Text style={styles.sliderLabel}>{`Pitch: ${speechPitch.toFixed(
          2,
        )}`}</Text>
        <Slider
          style={styles.slider}
          minimumValue={0.5}
          maximumValue={2}
          value={speechPitch}
          onSlidingComplete={setSpeechPitchHandler}
        />
      </View>

      <TextInput
        style={styles.textInput}
        multiline={true}
        onChangeText={setText}
        value={text}
      />

      <TextInput
        style={styles.llmInput}
        placeholder="Enter text for LLM"
        onChangeText={setLlmInput}
        value={llmInput}
      />

      <View style={styles.buttonContainer}>
        <Button title="Speak" onPress={speak} />
        <Button title="Stop" onPress={stop} />
        <Button title="Send to LLM" onPress={sendToLLM} />
      </View>

      <FlatList
        style={styles.listContainer}
        keyExtractor={item => item.id}
        renderItem={renderVoiceItem}
        extraData={selectedVoice}
        data={voices}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  label: {
    textAlign: 'center',
    marginBottom: 10,
  },
  sliderContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  sliderLabel: {
    width: 100,
  },
  slider: {
    flex: 1,
  },
  textInput: {
    borderColor: 'gray',
    borderWidth: 1,
    width: '100%',
    height: '30%',
    marginBottom: 10,
    padding: 10,
  },
  llmInput: {
    borderColor: 'gray',
    borderWidth: 1,
    width: '100%',
    height: 40,
    marginBottom: 10,
    padding: 10,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    marginBottom: 20,
  },
  listContainer: {
    width: '100%',
  },
});

export default App;
