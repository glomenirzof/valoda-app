import { azure } from './azure';
import { google } from './google';
import { piper } from './piper';
import type { Provider, ProviderId } from './types';

export const providers: Record<ProviderId, Provider> = { azure, google, piper };
export type { Provider, ProviderId, SynthResult, VoiceSpec } from './types';
