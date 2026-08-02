// ─── Domain types (match the database schema exactly) ────────────────────────

export type SessionStatus = 'processing' | 'ready' | 'published' | 'closed'

export interface Org {
  id: string
  name: string
  created_at: string
}

export interface Session {
  id: string
  org_id: string
  trainer_id: string
  title: string
  department: string | null
  session_date: string          // "YYYY-MM-DD"
  recording_url: string | null  // Supabase Storage path
  transcript: string | null
  pass_threshold: number        // percentage, default 70
  status: SessionStatus
  pdf_url: string | null
  created_at: string
}

export interface QuestionOption {
  key: string   // "A" | "B" | "C" | "D"
  text: string
}

export interface Question {
  id: string
  org_id: string
  session_id: string
  position: number              // 1 to 10
  question_text: string
  options: QuestionOption[]     // always 4 items
  correct_key: string           // "A" | "B" | "C" | "D"
  is_deleted: boolean
  created_at: string
}

export interface QuizAttempt {
  id: string
  org_id: string
  session_id: string
  participant_name: string
  score: number                 // number correct out of 10
  passed: boolean
  submitted_at: string
}

export interface Answer {
  id: string
  org_id: string
  attempt_id: string
  question_id: string
  selected_key: string          // "A" | "B" | "C" | "D"
  is_correct: boolean
}

// ─── Supabase generic type (expand later with generated types) ────────────────
// Run `npx supabase gen types typescript --local` after migrations to replace this.
export type Database = any
