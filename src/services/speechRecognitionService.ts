import { SpeechRecognitionEvent, StreamingTranscription } from '@/types/index'

interface WebkitSpeechRecognition {
  start(): void
  stop(): void
  abort(): void
  addEventListener(type: string, callback: EventListenerOrEventListenerObject): void
  removeEventListener(type: string, callback: EventListenerOrEventListenerObject): void
  continuous: boolean
  interimResults: boolean
  lang: string
}

declare global {
  interface Window {
    webkitSpeechRecognition: new () => WebkitSpeechRecognition
  }
}

export class SpeechRecognitionService {
  private recognition: WebkitSpeechRecognition | null = null
  private openaiKey: string = ''
  private isListening: boolean = false
  private audioStream: MediaStream | null = null
  private mediaRecorder: MediaRecorder | null = null

  async initialize() {
    const SpeechRecognition = window.webkitSpeechRecognition
    if (!SpeechRecognition) {
      throw new Error('Web Speech API not supported in this browser')
    }

    this.recognition = new SpeechRecognition()
    this.recognition.continuous = true
    this.recognition.interimResults = true
  }

  setApiKeys(keys: { openaiKey?: string }) {
    if (keys.openaiKey) this.openaiKey = keys.openaiKey
  }

  startListening(
    language: string,
    engine: 'webSpeech' | 'whisper',
    onResult: (event: SpeechRecognitionEvent | StreamingTranscription) => void,
    onError: (error: string) => void,
    deviceId?: string
  ) {
    if (!this.recognition) {
      onError('Speech Recognition not initialized')
      return
    }

    if (engine === 'webSpeech') {
      this.startWebSpeechRecognition(language, onResult, onError, deviceId)
    } else if (engine === 'whisper') {
      this.startWhisperRecognition(language, onResult, onError, deviceId)
    }
  }

  private startWebSpeechRecognition(
    language: string,
    onResult: (event: SpeechRecognitionEvent | StreamingTranscription) => void,
    onError: (error: string) => void,
    deviceId?: string
  ) {
    if (!this.recognition) return

    const langCode = language === 'ja' ? 'ja-JP' : 'en-US'
    this.recognition.lang = langCode
    this.isListening = true

    let finalTranscript = ''

    this.recognition.onresult = (event: any) => {
      let interimTranscript = ''
      let isFinal = false
      let confidence = 0

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcriptSegment = event.results[i][0].transcript
        confidence = event.results[i][0].confidence

        if (event.results[i].isFinal) {
          finalTranscript += transcriptSegment
          isFinal = true
        } else {
          interimTranscript += transcriptSegment
        }
      }

      // Emit streaming transcription with interim and final results
      onResult({
        interim: interimTranscript,
        final: finalTranscript,
        isFinal,
        confidence,
        language: (language as 'ja' | 'en'),
        timestamp: Date.now()
      } as StreamingTranscription)
    }

    this.recognition.onerror = (event: any) => {
      onError(`Speech Recognition error: ${event.error}`)
    }

    this.recognition.onend = () => {
      this.isListening = false
    }

    this.recognition.start()
  }

  private async startWhisperRecognition(
    language: string,
    onResult: (event: SpeechRecognitionEvent | StreamingTranscription) => void,
    onError: (error: string) => void,
    deviceId?: string
  ) {
    if (!this.openaiKey) {
      onError('OpenAI API key not configured for Whisper')
      return
    }

    try {
      const audioConstraints: any = { audio: true }
      if (deviceId) {
        audioConstraints.audio = { deviceId: { exact: deviceId } }
      }
      this.audioStream = await navigator.mediaDevices.getUserMedia(audioConstraints)
      this.mediaRecorder = new MediaRecorder(this.audioStream)

      const audioChunks: Blob[] = []
      let partialTranscript = ''

      this.mediaRecorder.ondataavailable = async (event) => {
        audioChunks.push(event.data)

        // Send chunks every 1-2 seconds for streaming transcription
        if (audioChunks.length >= 2) {
          const audioBlob = new Blob([audioChunks[audioChunks.length - 1]], { type: 'audio/wav' })
          try {
            const transcript = await this.transcribeWithWhisper(audioBlob, language)
            partialTranscript += transcript + ' '

            onResult({
              interim: transcript,
              final: partialTranscript.trim(),
              isFinal: false,
              confidence: 0.85,
              language: (language as 'ja' | 'en'),
              timestamp: Date.now()
            } as StreamingTranscription)
          } catch (error) {
            console.error('Streaming Whisper error:', error)
          }
        }
      }

      this.mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunks, { type: 'audio/wav' })
        try {
          const finalTranscript = await this.transcribeWithWhisper(audioBlob, language)

          onResult({
            interim: '',
            final: finalTranscript,
            isFinal: true,
            confidence: 1.0,
            language: (language as 'ja' | 'en'),
            timestamp: Date.now()
          } as StreamingTranscription)
        } catch (error) {
          onError(`Whisper transcription error: ${error}`)
        }

        // Clean up
        this.audioStream?.getTracks().forEach(track => track.stop())
        this.audioStream = null
        this.mediaRecorder = null
      }

      this.isListening = true
      this.mediaRecorder.start(1000) // Emit data every 1 second for streaming
    } catch (error) {
      onError(`Microphone access error: ${error}`)
    }
  }

  private async transcribeWithWhisper(audioBlob: Blob, language: string): Promise<string> {
    const formData = new FormData()
    formData.append('file', audioBlob, 'audio.wav')
    formData.append('model', 'whisper-1')
    formData.append('language', language === 'ja' ? 'ja' : 'en')

    try {
      const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.openaiKey}`
        },
        body: formData
      })

      if (!response.ok) {
        throw new Error(`Whisper API error: ${response.statusText}`)
      }

      const data = await response.json()
      return data.text
    } catch (error) {
      throw error
    }
  }

  stopListening() {
    if (this.recognition && this.isListening) {
      this.recognition.stop()
      this.isListening = false
    }

    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop()
      this.isListening = false
    }

    if (this.audioStream) {
      this.audioStream.getTracks().forEach(track => track.stop())
      this.audioStream = null
    }
  }

  isCurrentlyListening(): boolean {
    return this.isListening
  }
}

export const speechRecognitionService = new SpeechRecognitionService()
