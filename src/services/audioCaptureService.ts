export interface AudioCaptureConfig {
  source: 'microphone' | 'system' | 'application'
  sampleRate: 16000 | 44100 | 48000
  channelCount: 1 | 2
  echoCancellation: boolean
  noiseSuppression: boolean
  autoGainControl: boolean
  gainLevel: number // 0.0 to 2.0
  bufferSize: 256 | 512 | 1024 | 2048
  deviceId?: string
  applicationId?: string
}

export interface AudioDevice {
  deviceId: string
  label: string
  kind: 'audioinput' | 'audiooutput'
}

export interface AudioLevelData {
  current: number
  peak: number
  average: number
}

export class AudioCaptureService {
  private mediaStream: MediaStream | null = null
  private audioContext: AudioContext | null = null
  private analyser: AnalyserNode | null = null
  private processor: ScriptProcessorNode | null = null
  private gainNode: GainNode | null = null
  private isCapturing = false
  private config: AudioCaptureConfig = {
    source: 'microphone',
    sampleRate: 44100,
    channelCount: 1,
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
    gainLevel: 1.0,
    bufferSize: 4096
  }
  private audioLevelData: AudioLevelData = { current: 0, peak: 0, average: 0 }
  private dataArray: Uint8Array | null = null

  async initialize() {
    if (!this.audioContext) {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
    }
  }

  setConfig(config: Partial<AudioCaptureConfig>) {
    this.config = { ...this.config, ...config }
  }

  getConfig(): AudioCaptureConfig {
    return { ...this.config }
  }

  /**
   * Get all available audio devices (input and output)
   */
  async getAudioDevices(): Promise<AudioDevice[]> {
    try {
      // First, try to get permission by requesting media
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
          audio: {
            echoCancellation: false,
            noiseSuppression: false,
            autoGainControl: false
          } 
        })
        // Stop all tracks immediately - we only needed the permission
        stream.getTracks().forEach(track => track.stop())
        console.log('✅ Microphone permission granted')
      } catch (e) {
        const err = e as Error
        if (err.name === 'NotAllowedError') {
          console.log('❌ Microphone permission denied by user')
        } else {
          console.warn('⚠️ Could not request microphone permission:', err.message)
        }
      }

      // Wait a moment for the browser to update device list after permission
      await new Promise(resolve => setTimeout(resolve, 300))

      const devices = await navigator.mediaDevices.enumerateDevices()
      console.log('All devices found:', devices.length)
      const audioDevices = devices
        .filter(d => d.kind === 'audioinput' || d.kind === 'audiooutput')
        .map(d => ({
          deviceId: d.deviceId,
          label: d.label || `Audio Device ${d.deviceId.slice(0, 5)}`,
          kind: d.kind as 'audioinput' | 'audiooutput'
        }))
        .filter((d, i, arr) => arr.findIndex(x => x.deviceId === d.deviceId) === i) // Remove duplicates
      
      console.log('Audio devices found:', audioDevices.length, audioDevices)
      return audioDevices
    } catch (error) {
      console.error('Error enumerating audio devices:', error)
      return []
    }
  }

  /**
   * Get only audio input devices (microphones)
   */
  async getAudioInputDevices(): Promise<AudioDevice[]> {
    try {
      console.log('🔍 [getAudioInputDevices] Starting enumeration...')
      
      let grantedStream: MediaStream | null = null
      
      try {
        console.log('📡 [getAudioInputDevices] Requesting microphone permission...')
        grantedStream = await navigator.mediaDevices.getUserMedia({ audio: true })
        console.log('✅ [getAudioInputDevices] Permission granted, got stream')
      } catch (e) {
        const err = e as Error
        if (err.name === 'NotAllowedError') {
          console.log('❌ [getAudioInputDevices] User denied microphone permission')
        } else {
          console.log(`⚠️ [getAudioInputDevices] getUserMedia error: ${err.name} - ${err.message}`)
        }
      }

      // Enumerate while stream may still be active (helps on some systems)
      console.log('📋 [getAudioInputDevices] Enumerating devices...')
      const allDevices = await navigator.mediaDevices.enumerateDevices()
      console.log(`📊 [getAudioInputDevices] Total devices: ${allDevices.length}`)
      
      // Log each device
      allDevices.forEach((d, idx) => {
        console.log(`   [${idx}] ${d.kind.padEnd(12)} | ${(d.label || '(no label)').substring(0, 40)} | ${d.deviceId.substring(0, 20)}...`)
      })

      // Stop the stream after enumeration if we got one
      if (grantedStream) {
        grantedStream.getTracks().forEach(track => {
          console.log(`🛑 [getAudioInputDevices] Stopping track: ${track.label}`)
          track.stop()
        })
      }

      // Filter for input only
      const inputDevices = allDevices.filter(d => d.kind === 'audioinput')
      console.log(`🎤 [getAudioInputDevices] Found ${inputDevices.length} audio input device(s)`)
      
      // Transform
      const result = inputDevices
        .map((d, idx) => ({
          deviceId: d.deviceId,
          label: d.label || `Microphone ${idx + 1}`,
          kind: d.kind as 'audioinput'
        }))
        .filter((d, i, arr) => arr.findIndex(x => x.deviceId === d.deviceId) === i)
      
      console.log(`✨ [getAudioInputDevices] Returning ${result.length} device(s):`, result)
      return result
    } catch (error) {
      console.error('❌ [getAudioInputDevices] Unexpected error:', error)
      return []
    }
  }

  /**
   * Get system audio / application audio source
   * Opens system audio selection dialog (getDisplayMedia)
   */
  async selectSystemAudioSource(): Promise<{ stream: MediaStream; label: string } | null> {
    try {
      const displayStream = await navigator.mediaDevices.getDisplayMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false
        },
        video: false
      } as any)

      return {
        stream: displayStream,
        label: 'System Audio / Application'
      }
    } catch (error) {
      if ((error as Error).name !== 'NotAllowedError') {
        console.error('Error selecting system audio:', error)
      }
      return null
    }
  }

  /**
   * Start capturing audio from configured source
   */
  async startCapture(
    onAudioData: (data: Float32Array, levelData: AudioLevelData) => void,
    onError: (error: string) => void
  ) {
    try {
      await this.initialize()

      switch (this.config.source) {
        case 'microphone':
          await this.startMicrophoneCapture()
          break
        case 'system':
          await this.startSystemAudioCapture()
          break
        case 'application':
          await this.startApplicationAudioCapture()
          break
      }

      this.setupAudioProcessing(onAudioData, onError)
      this.isCapturing = true
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error)
      onError(`Audio capture failed: ${errorMsg}`)
      this.isCapturing = false
    }
  }

  /**
   * Start microphone capture
   */
  private async startMicrophoneCapture() {
    const constraints: MediaStreamAudioConstraints = {
      echoCancellation: this.config.echoCancellation,
      noiseSuppression: this.config.noiseSuppression,
      autoGainControl: this.config.autoGainControl
    }

    if (this.config.deviceId) {
      constraints.deviceId = { exact: this.config.deviceId }
    }

    this.mediaStream = await navigator.mediaDevices.getUserMedia({ audio: constraints })
  }

  /**
   * Start system audio capture (requires user permission)
   */
  private async startSystemAudioCapture() {
    try {
      const displayStream = await navigator.mediaDevices.getDisplayMedia({
        audio: true,
        video: false
      } as any)

      this.mediaStream = displayStream
    } catch (error) {
      throw new Error('System audio capture requires user permission and is not available on all platforms')
    }
  }

  /**
   * Start application audio capture (platform-specific)
   */
  private async startApplicationAudioCapture() {
    // Note: Direct application audio capture requires platform-specific implementation
    // For now, fall back to microphone or system audio
    console.warn('Application-specific audio capture requires native module support')
    await this.startMicrophoneCapture()
  }

  /**
   * Setup audio processing pipeline
   */
  private setupAudioProcessing(
    onAudioData: (data: Float32Array, levelData: AudioLevelData) => void,
    onError: (error: string) => void
  ) {
    if (!this.mediaStream || !this.audioContext) return

    const source = this.audioContext.createMediaStreamSource(this.mediaStream)

    // Create analyser for level monitoring
    this.analyser = this.audioContext.createAnalyser()
    this.analyser.fftSize = 2048
    this.dataArray = new Uint8Array(this.analyser.frequencyBinCount)

    // Create gain node for volume control
    this.gainNode = this.audioContext.createGain()
    this.gainNode.gain.setValueAtTime(this.config.gainLevel, 0)

    // Create script processor for audio processing
    this.processor = this.audioContext.createScriptProcessor(this.config.bufferSize, 1, 1)

    this.processor.onaudioprocess = (event) => {
      const inputData = event.inputBuffer.getChannelData(0)
      const audioData = new Float32Array(inputData)

      // Update audio levels
      this.updateAudioLevels()

      onAudioData(audioData, this.audioLevelData)
    }

    // Connect nodes
    source.connect(this.analyser)
    this.analyser.connect(this.gainNode)
    this.gainNode.connect(this.processor)
    this.processor.connect(this.audioContext.destination)
  }

  /**
   * Update audio level metrics
   */
  private updateAudioLevels() {
    if (!this.analyser || !this.dataArray) return

    this.analyser.getByteFrequencyData(this.dataArray)

    const sum = this.dataArray.reduce((a, b) => a + b, 0)
    const average = sum / this.dataArray.length
    const peak = Math.max(...this.dataArray)

    this.audioLevelData = {
      current: average / 255,
      peak: peak / 255,
      average: average / 255
    }
  }

  /**
   * Get current audio levels
   */
  getAudioLevels(): AudioLevelData {
    return { ...this.audioLevelData }
  }

  /**
   * Set gain/volume level
   */
  setGain(level: number) {
    this.config.gainLevel = Math.max(0, Math.min(2, level))
    if (this.gainNode) {
      this.gainNode.gain.setValueAtTime(this.config.gainLevel, 0)
    }
  }

  /**
   * Get current gain level
   */
  getGain(): number {
    return this.config.gainLevel
  }

  /**
   * Toggle echo cancellation
   */
  setEchoCancellation(enabled: boolean) {
    this.config.echoCancellation = enabled
  }

  /**
   * Toggle noise suppression
   */
  setNoiseSuppression(enabled: boolean) {
    this.config.noiseSuppression = enabled
  }

  /**
   * Toggle auto gain control
   */
  setAutoGainControl(enabled: boolean) {
    this.config.autoGainControl = enabled
  }

  /**
   * Stop capturing audio
   */
  stopCapture() {
    this.isCapturing = false

    if (this.processor) {
      this.processor.disconnect()
      this.processor = null
    }

    if (this.gainNode) {
      this.gainNode.disconnect()
      this.gainNode = null
    }

    if (this.analyser) {
      this.analyser.disconnect()
      this.analyser = null
    }

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => track.stop())
      this.mediaStream = null
    }

    if (this.audioContext) {
      this.audioContext.close()
      this.audioContext = null
    }
  }

  /**
   * Check if currently capturing
   */
  isCurrentlyCapturing(): boolean {
    return this.isCapturing
  }

  /**
   * Pause capture (keeps stream alive)
   */
  pauseCapture() {
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => track.stop())
    }
    this.isCapturing = false
  }

  /**
   * Resume capture after pause
   */
  async resumeCapture(onAudioData: (data: Float32Array, levelData: AudioLevelData) => void) {
    if (!this.isCurrentlyCapturing()) {
      await this.startCapture(onAudioData, (error) => console.error(error))
    }
  }

  /**
   * Get audio context
   */
  getAudioContext(): AudioContext | null {
    return this.audioContext
  }

  /**
   * Listen for device changes
   */
  onDeviceChange(callback: () => void) {
    navigator.mediaDevices.addEventListener('devicechange', callback)
  }

  /**
   * Stop listening for device changes
   */
  offDeviceChange(callback: () => void) {
    navigator.mediaDevices.removeEventListener('devicechange', callback)
  }
}

export const audioCaptureService = new AudioCaptureService()

