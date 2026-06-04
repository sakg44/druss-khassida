export type PlaybackMode = 'xaab' | 'vers' | 'boucle';
export type SessionView = 'setup' | 'active' | 'complete';

export interface SessionConfig {
  khassidaId: string;
  startVers: number;
  endVers: number;
  repetitions: number;
  playbackMode: PlaybackMode;
  playbackRate: number;
}

export interface DrussSession {
  config: SessionConfig;
  currentVers: number;
  currentXaab: number;
  currentRepetition: number;
  currentLoopPass: number;
  isRepeat: boolean;
  repeatOf: number | null;
  isPlaying: boolean;
  isPaused: boolean;
  isComplete: boolean;
}

export const REPETITION_OPTIONS = [1, 2, 3, 5, 7] as const;
export const PLAYBACK_RATE_OPTIONS = [0.5, 0.75, 1, 1.25, 1.5] as const;
