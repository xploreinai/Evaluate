'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { questionOptions } from '@/types'
import type { Session, Question } from '@/types'


export default function QuizPage({
  params,
}: {
  params: { id: string }
}) {
  const router = useRouter()
  const [session, setSession] = useState<Session | null>(null)
  const [questions, setQuestions] = useState<Question[]>([])
  const [participantName, setParticipantName] = useState('')
  const [isQuizStarted, setIsQuizStarted] = useState(false)
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchSessionAndQuestions()
  }, [params.id])

  async function fetchSessionAndQuestions() {
    try {
      const { data: sessionData, error: sessionError } = await supabase
        .from('sessions')
        .select('*')
        .eq('id', params.id)
        .eq('status', 'published')
        .single()

      if (sessionError) throw sessionError

      const { data: questionsData, error: questionsError } = await supabase
        .from('questions')
        .select('*')
        .eq('session_id', params.id)
        .is('deleted_at', null)
        .order('created_at')

      if (questionsError) throw questionsError

      setSession(sessionData)
      setQuestions(questionsData || [])
      setIsLoading(false)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load quiz'
      setError(message)
      setIsLoading(false)
    }
  }

  function handleStartQuiz(e: React.FormEvent) {
    e.preventDefault()
    if (!participantName.trim()) return
    setIsQuizStarted(true)
  }

  async function handleSelectAnswer(selectedKey: string) {
    const questionId = questions[currentQuestionIndex].id
    setAnswers(prev => ({
      ...prev,
      [questionId]: selectedKey,
    }))

    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1)
    } else {
      await submitQuiz(selectedKey)
    }
  }

  async function submitQuiz(lastAnswer: string) {
    setIsSubmitting(true)
    try {
      const finalAnswers = {
        ...answers,
        [questions[currentQuestionIndex].id]: lastAnswer,
      }

      let correctCount = 0
      questions.forEach(q => {
        if (finalAnswers[q.id] === q.correct) {
          correctCount++
        }
      })

      const passThreshold = session?.pass_threshold ?? 70
      const passed = questions.length > 0
        ? (correctCount / questions.length) * 100 >= passThreshold
        : false

      // Participants may write an attempt but not read one back, so the id is
      // generated here rather than returned by the insert.
      const attemptId = crypto.randomUUID()

      const { error: attemptError } = await supabase
        .from('quiz_attempts')
        .insert({
          id: attemptId,
          session_id: params.id,
          participant_name: participantName.trim(),
          score: correctCount,
          total_questions: questions.length,
          passed,
        })

      if (attemptError) throw attemptError

      const answerRows = questions.map(q => ({
        attempt_id: attemptId,
        question_id: q.id,
        selected: finalAnswers[q.id],
        is_correct: finalAnswers[q.id] === q.correct,
      }))

      const { error: answersError } = await supabase
        .from('answers')
        .insert(answerRows)

      if (answersError) throw answersError

      router.push(
        `/quiz/${params.id}/done?score=${correctCount}&passed=${passed}`
      )
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to submit quiz'
      setError(message)
      setIsSubmitting(false)
    }
  }

  if (error) {
    return (
      <div>
        <h2 className="text-2xl text-ink mb-4">Error</h2>
        <p className="text-sm text-ink bg-surface-subtle border border-ink rounded-lg px-4 py-3">
          {error}
        </p>
      </div>
    )
  }

  if (isLoading || !session) {
    return (
      <div className="text-center py-20">
        <div className="text-4xl mb-4">⏳</div>
        <h2 className="text-xl text-ink">Loading quiz…</h2>
      </div>
    )
  }

  if (!questions.length) {
    return (
      <div className="text-center py-20">
        <div className="text-4xl mb-4">⚠️</div>
        <h2 className="text-xl text-ink mb-2">Quiz not available</h2>
        <p className="text-muted">This quiz has no questions yet.</p>
      </div>
    )
  }

  // Name entry state
  if (!isQuizStarted) {
    return (
      <div>
        <h2 className="text-2xl text-ink mb-1">
          {session.topic}
        </h2>
        <p className="text-muted mb-8">
          {questions.length} questions • 5 minutes
        </p>

        <form onSubmit={handleStartQuiz} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-ink mb-1.5">
              Your name
            </label>
            <input
              type="text"
              value={participantName}
              onChange={e => setParticipantName(e.target.value)}
              placeholder="Enter your full name"
              required
              autoFocus
              className="w-full border border-line rounded-xl px-4 py-2.5 text-ink placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-ink focus:border-transparent transition"
            />
          </div>

          <button
            type="submit"
            disabled={!participantName.trim()}
            className="w-full btn-primary"
          >
            Start quiz →
          </button>
        </form>
      </div>
    )
  }

  // Quiz state
  const currentQuestion = questions[currentQuestionIndex]
  const progress = ((currentQuestionIndex + 1) / questions.length) * 100

  return (
    <div>
      {/* Progress bar */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-medium text-ink">
            Question {currentQuestionIndex + 1} of {questions.length}
          </p>
          <p className="text-sm text-muted">{Math.round(progress)}%</p>
        </div>
        <div className="w-full bg-surface-subtle rounded h-2">
          <div
            className="bg-ink h-2 rounded transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Question */}
      <div className="mb-8">
        <h2 className="text-xl text-ink mb-6">
          {currentQuestion.question}
        </h2>

        {/* Answer options */}
        <div className="space-y-3">
          {questionOptions(currentQuestion).map(option => (
            <button
              key={option.key}
              onClick={() => handleSelectAnswer(option.key)}
              disabled={isSubmitting}
              className="w-full bg-surface border-2 border-line hover:border-ink hover:bg-surface-subtle rounded-xl px-6 py-4 text-left transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <div className="flex items-center gap-4">
                <div className="w-8 h-8 rounded border-2 border-line flex items-center justify-center font-semibold text-ink group-hover:border-ink">
                  {option.key}
                </div>
                <span className="flex-1 text-ink font-medium">{option.text}</span>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
