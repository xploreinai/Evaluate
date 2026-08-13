// ─── Domain types (match 001_schema_v2.sql + 003_open_access.sql) ────────────

export type SessionStatus = 'draft' | 'published' | 'closed'

export interface Org {
  id: string
  name: string
  created_at: string
}

export interface Profile {
  id: string
  org_id: string
  full_name: string | null
  created_at: string
}

export interface Session {
  id: string
  trainer_id: string | null     // no auth yet, so this can be unset
  topic: string
  session_date: string          // "YYYY-MM-DD"
  start_time: string | null     // "HH:MM"
  end_time: string | null
  status: SessionStatus
  pass_threshold: number        // percentage, default 70
  created_at: string
  updated_at: string
}

export type OptionKey = 'a' | 'b' | 'c' | 'd'

export interface Question {
  id: string
  session_id: string
  question: string
  option_a: string
  option_b: string
  option_c: string
  option_d: string
  correct: OptionKey
  deleted_at: string | null     // soft delete
  created_at: string
}

export interface QuizAttempt {
  id: string
  session_id: string
  participant_name: string
  score: number | null
  total_questions: number | null
  passed: boolean | null
  created_at: string
}

export interface Answer {
  id: string
  attempt_id: string
  question_id: string
  selected: OptionKey
  is_correct: boolean | null
  created_at: string
}

export interface QuestionOption {
  key: OptionKey
  text: string
}

// The schema stores the four choices as separate columns; the UI renders them
// as a list. This is the bridge between the two.
export function questionOptions(q: Question): QuestionOption[] {
  return [
    { key: 'a', text: q.option_a },
    { key: 'b', text: q.option_b },
    { key: 'c', text: q.option_c },
    { key: 'd', text: q.option_d },
  ]
}

export function optionColumns(options: QuestionOption[]) {
  return {
    option_a: options[0]?.text ?? '',
    option_b: options[1]?.text ?? '',
    option_c: options[2]?.text ?? '',
    option_d: options[3]?.text ?? '',
  }
}

// ─── Supabase generic type (expand later with generated types) ────────────────
// Run `npx supabase gen types typescript --local` after migrations to replace this.
export type Database = any
