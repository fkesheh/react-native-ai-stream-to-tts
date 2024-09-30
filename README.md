# react-native-ai-stream-to-tts

A proof-of-concept for streaming AI-generated text directly to a Text-to-Speech (TTS) engine in React Native, with speech recognition capabilities.

## Overview

This project is based on [react-native-tts](https://github.com/ak1394/react-native-tts) and [react-native-vosk](https://github.com/Daniil-Borisov/react-native-vosk) with custom modifications to enable real-time streaming of AI-generated text to a TTS engine and speech recognition.

## Demo Video

[Demo Video](demo/video.mp4)

## Key Features

- Custom Android TTS implementation for direct AI stream to speech conversion (patches/react-native-tts+4.1.1.patch)
- Integration with AI providers for text generation
- Real-time text-to-speech conversion as AI generates content
- Speech recognition using Vosk for voice input

## TODOs

- Check iOS implementation (currently it's the same as the original react-native-tts)
- Add buffered start to avoid pauses in the beginning of stream playback (currently small buffer was added on react-native side)

## Getting Started

1. Clone this repository
2. Install dependencies using `npm install` or `yarn install`
3. Create a `.env` file based on `.env.sample` and configure the following variables:
   - `API_URL`: The endpoint for your AI provider
   - `API_KEY`: Your API key for authentication
   - `MODEL`: The AI model you wish to use

## Usage

Refer to the example in `App.tsx` for implementation details. The app demonstrates how to set up the AI stream, connect it to the TTS engine, and use Vosk for speech recognition.

Key components in `App.tsx`:
- AI text generation and streaming
- Text-to-Speech conversion
- Speech recognition with Vosk

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.