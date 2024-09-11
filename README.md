# react-native-ai-stream-to-tts

A proof-of-concept for streaming AI-generated text directly to a Text-to-Speech (TTS) engine in React Native.

## Overview

This project is a based on [react-native-tts](https://github.com/ak1394/react-native-tts) with custom modifications to enable real-time streaming of AI-generated text to a TTS engine.

## Key Features

- Custom Android TTS implementation for direct AI stream to speech conversion (patches/react-native-tts+4.1.1.patch)
- Integration with AI providers for text generation
- Real-time text-to-speech conversion as AI generates content
- TODO: Unmodified iOS implementation (same as the original react-native-tts)

## Getting Started

1. Clone this repository
2. Install dependencies using `npm install` or `yarn install`
3. Open `App.tsx` and configure the following variables:
   - `API_URL`: The endpoint for your AI provider
   - `MODEL`: The AI model you wish to use
   - `API_KEY`: Your API key for authentication

## Usage

Refer to the example in `App.tsx` for implementation details. The app demonstrates how to set up the AI stream and connect it to the TTS engine.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.