import { TranslationResult, StreamingTranslation } from '@/types/index'
import axios from 'axios'

export class TranslationService {
  private openaiKey: string = ''
  private deeplKey: string = ''
  private googleAppsScriptUrl: string = ''

  setApiKeys(keys: { openaiKey?: string; deeplKey?: string; googleAppsScriptUrl?: string }) {
    if (keys.openaiKey) this.openaiKey = keys.openaiKey
    if (keys.deeplKey) this.deeplKey = keys.deeplKey
    if (keys.googleAppsScriptUrl) this.googleAppsScriptUrl = keys.googleAppsScriptUrl
  }

  async translateWithGoogle(text: string, targetLanguage: string): Promise<string> {
    try {
      // Using Google Translate API via Google Apps Script
      if (!this.googleAppsScriptUrl) {
        throw new Error('Google Apps Script URL not configured')
      }

      const response = await axios.post(this.googleAppsScriptUrl, {
        text,
        targetLanguage
      })

      return response.data.translatedText
    } catch (error) {
      console.error('Google translation error:', error)
      throw error
    }
  }

  async translateWithDeepL(text: string, targetLanguage: string): Promise<string> {
    try {
      if (!this.deeplKey) {
        throw new Error('DeepL API key not configured')
      }

      const response = await axios.post('https://api-free.deepl.com/v1/translate', {
        texts: [text],
        target_lang: targetLanguage === 'ja' ? 'JA' : 'EN'
      }, {
        headers: {
          'Authorization': `DeepL-Auth-Key ${this.deeplKey}`,
          'Content-Type': 'application/json'
        }
      })

      return response.data.translations[0].text
    } catch (error) {
      console.error('DeepL translation error:', error)
      throw error
    }
  }

  async translateWithOpenAI(text: string, targetLanguage: string): Promise<string> {
    try {
      if (!this.openaiKey) {
        throw new Error('OpenAI API key not configured')
      }

      const targetLang = targetLanguage === 'ja' ? 'Japanese' : 'English'
      const response = await axios.post('https://api.openai.com/v1/chat/completions', {
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: `You are a translator. Translate the following text to ${targetLang} naturally and accurately.`
          },
          {
            role: 'user',
            content: text
          }
        ],
        temperature: 0.3
      }, {
        headers: {
          'Authorization': `Bearer ${this.openaiKey}`,
          'Content-Type': 'application/json'
        }
      })

      return response.data.choices[0].message.content
    } catch (error) {
      console.error('OpenAI translation error:', error)
      throw error
    }
  }

  async translate(
    text: string,
    engine: 'google' | 'deepl' | 'openai',
    targetLanguage: string
  ): Promise<TranslationResult> {
    let translatedText: string

    if (engine === 'google') {
      translatedText = await this.translateWithGoogle(text, targetLanguage)
    } else if (engine === 'deepl') {
      translatedText = await this.translateWithDeepL(text, targetLanguage)
    } else if (engine === 'openai') {
      translatedText = await this.translateWithOpenAI(text, targetLanguage)
    } else {
      throw new Error(`Unknown translation engine: ${engine}`)
    }

    return {
      original: text,
      translated: translatedText,
      sourceLanguage: targetLanguage === 'ja' ? 'en' : 'ja',
      targetLanguage: targetLanguage,
      timestamp: Date.now()
    }
  }

  async translateStreaming(
    text: string,
    engine: 'google' | 'deepl' | 'openai',
    targetLanguage: string,
    sourceLanguage: 'ja' | 'en',
    onPartial?: (partial: StreamingTranslation) => void
  ): Promise<StreamingTranslation> {
    // For OpenAI, we can implement streaming with SSE
    if (engine === 'openai' && onPartial) {
      return this.translateWithOpenAIStreaming(text, targetLanguage, sourceLanguage, onPartial)
    }

    // For other engines, get full translation and emit as partial
    const result = await this.translate(text, engine, targetLanguage)

    if (onPartial) {
      onPartial({
        original: text,
        partial: result.translated,
        final: result.translated,
        isFinal: true,
        sourceLanguage,
        targetLanguage: (targetLanguage as 'ja' | 'en'),
        timestamp: Date.now()
      })
    }

    return {
      original: text,
      partial: result.translated,
      final: result.translated,
      isFinal: true,
      sourceLanguage,
      targetLanguage: (targetLanguage as 'ja' | 'en'),
      timestamp: Date.now()
    }
  }

  private async translateWithOpenAIStreaming(
    text: string,
    targetLanguage: string,
    sourceLanguage: 'ja' | 'en',
    onPartial: (partial: StreamingTranslation) => void
  ): Promise<StreamingTranslation> {
    if (!this.openaiKey) {
      throw new Error('OpenAI API key not configured')
    }

    try {
      const targetLang = targetLanguage === 'ja' ? 'Japanese' : 'English'
      const response = await axios.post(
        'https://api.openai.com/v1/chat/completions',
        {
          model: 'gpt-3.5-turbo',
          messages: [
            {
              role: 'system',
              content: `You are a translator. Translate the following text to ${targetLang} naturally and accurately.`
            },
            {
              role: 'user',
              content: text
            }
          ],
          temperature: 0.3
        },
        {
          headers: {
            'Authorization': `Bearer ${this.openaiKey}`,
            'Content-Type': 'application/json'
          }
        }
      )

      const translatedText = response.data.choices[0].message.content

      // Emit partial updates
      let accumulated = ''
      for (let i = 0; i < translatedText.length; i++) {
        accumulated += translatedText[i]
        onPartial({
          original: text,
          partial: accumulated,
          isFinal: false,
          sourceLanguage,
          targetLanguage: (targetLanguage as 'ja' | 'en'),
          timestamp: Date.now()
        })
      }

      // Emit final result
      const finalResult: StreamingTranslation = {
        original: text,
        partial: translatedText,
        final: translatedText,
        isFinal: true,
        sourceLanguage,
        targetLanguage: (targetLanguage as 'ja' | 'en'),
        timestamp: Date.now()
      }

      onPartial(finalResult)
      return finalResult
    } catch (error) {
      console.error('OpenAI streaming translation error:', error)
      throw error
    }
  }
}

export const translationService = new TranslationService()
