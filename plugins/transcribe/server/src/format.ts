export const MODEL_LABEL = "Deepgram Nova-3";

/** Whole minutes at 60 s and above, otherwise whole seconds. */
export function formatDuration(seconds: number): string {
  if (seconds >= 60) return `${Math.round(seconds / 60)} min`;
  return `${Math.round(seconds)} s`;
}

/** YYYY-MM-DD in the machine's local time zone. */
export function formatLocalDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export interface RenderOptions {
  audioName: string;
  date: Date;
  durationSeconds: number;
  paragraphs: string[];
}

/** The saved transcript file, exactly as specified in the design spec section 3. */
export function renderTranscript(opts: RenderOptions): string {
  const header = [
    `# Transcript: ${opts.audioName}`,
    "",
    `Transcribed ${formatLocalDate(opts.date)} · ${formatDuration(opts.durationSeconds)} · ${MODEL_LABEL}`,
  ];
  const body = opts.paragraphs.map((p) => p.trim()).filter((p) => p.length > 0);
  return [...header, "", ...body.flatMap((p) => [p, ""])].join("\n");
}
