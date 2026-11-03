export type ProviderId = 'azure' | 'google' | 'piper';

export interface VoiceSpec {
  provider: ProviderId;
  /** Provider voice id, e.g. lv-LV-EveritaNeural, lv-LV-Chirp3-HD-Zephyr, lv_LV-aivars-medium */
  voice: string;
  /** Human label shown only after "Показать ответы" */
  label: string;
  /** 1 = normal; 0.8 = slower */
  rate: number;
}

export interface SynthResult {
  mp3: Buffer;
  /** Characters of plain text sent (what TTS vendors bill on for plain-text input) */
  textChars: number;
  /** Characters of the full request body (SSML etc.), for reference */
  payloadChars: number;
}

export interface Provider {
  id: ProviderId;
  /** Returns a reason string when the provider can't run (missing key, etc.), else null */
  unavailable(): string | null;
  /** Voices to use for Latvian; may query the vendor */
  latvianVoices(): Promise<{ voice: string; label: string }[]>;
  synthesize(text: string, voice: string, rate: number): Promise<SynthResult>;
}
