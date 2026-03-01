import { useState } from 'react'
import { apiFetch } from '../../lib/api-fetch'
import { RadioGroup, RadioGroupItem } from '@mycscompanion/ui/src/components/ui/radio-group'
import { Label } from '@mycscompanion/ui/src/components/ui/label'
import { Button } from '@mycscompanion/ui/src/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@mycscompanion/ui/src/components/ui/card'

interface Question {
  readonly id: number
  readonly code: string
  readonly prompt: string
  readonly options: readonly string[]
  readonly correctIndex: number
}

const QUESTIONS: readonly Question[] = [
  {
    id: 1,
    code: `func count(items []string, target string) int {
    total := 0
    for _, item := range items {
        if item == target {
            total++
        }
    }
    return total
}`,
    prompt: 'What does count([]string{"a", "b", "a", "c", "a"}, "a") return?',
    options: ['1', '2', '3', '5'],
    correctIndex: 2,
  },
  {
    id: 2,
    code: `func transform(values []int) []int {
    result := []int{}
    for _, v := range values {
        if v%2 == 0 {
            result = append(result, v*v)
        }
    }
    return result
}`,
    prompt: 'What does transform([]int{1, 2, 3, 4, 5}) return?',
    options: ['[1, 4, 9, 16, 25]', '[2, 4]', '[4, 16]', '[1, 9, 25]'],
    correctIndex: 2,
  },
  {
    id: 3,
    code: `func summarize(records map[string]int) int {
    sum := 0
    for _, v := range records {
        if v > 10 {
            sum += v
        }
    }
    return sum
}`,
    prompt: 'What does summarize(map[string]int{"a": 5, "b": 15, "c": 3, "d": 20}) return?',
    options: ['43', '35', '15', '20'],
    correctIndex: 1,
  },
]

interface SkillFloorCheckProps {
  readonly onComplete: (passed: boolean) => void
}

function SkillFloorCheck({ onComplete }: SkillFloorCheckProps): React.ReactElement {
  const [answers, setAnswers] = useState<Record<number, number>>({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const allAnswered = QUESTIONS.every((q) => answers[q.id] !== undefined)

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const correctCount = QUESTIONS.reduce(
      (acc, q) => acc + (answers[q.id] === q.correctIndex ? 1 : 0),
      0
    )
    const passed = correctCount >= 2

    try {
      await apiFetch('/api/account/skill-assessment', {
        method: 'POST',
        body: JSON.stringify({ passed }),
      })
      onComplete(passed)
    } catch {
      setError("Couldn't save your results. Try again.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-8">
      <Card className="w-full max-w-[600px]">
        <CardHeader className="text-center">
          <CardTitle>
            <h1 className="text-h2 font-semibold text-foreground">
              Let&apos;s make sure this is the right fit
            </h1>
          </CardTitle>
          <p className="text-body-sm text-muted-foreground">
            Read the Go snippets below and pick the best answer for each.
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={(e) => void handleSubmit(e)} className="flex flex-col gap-6">
            {QUESTIONS.map((q) => (
              <div key={q.id} className="flex flex-col gap-3">
                <pre className="font-mono bg-muted rounded-md p-4 text-sm overflow-x-auto">
                  <code>{q.code}</code>
                </pre>
                <p className="text-body-sm text-foreground">{q.prompt}</p>
                <RadioGroup
                  aria-label={`Question ${q.id}`}
                  value={answers[q.id] !== undefined ? String(answers[q.id]) : ''}
                  onValueChange={(value) =>
                    setAnswers((prev) => ({ ...prev, [q.id]: Number(value) }))
                  }
                  disabled={loading}
                >
                  {q.options.map((option, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <RadioGroupItem
                        value={String(index)}
                        id={`q${q.id}-option-${index}`}
                        className="min-h-5 min-w-5"
                      />
                      <Label
                        htmlFor={`q${q.id}-option-${index}`}
                        className="cursor-pointer text-body-sm"
                      >
                        {option}
                      </Label>
                    </div>
                  ))}
                </RadioGroup>
              </div>
            ))}

            <Button
              type="submit"
              disabled={!allAnswered || loading}
              className="min-h-11"
              aria-disabled={loading}
            >
              {loading ? 'Saving...' : 'Continue'}
            </Button>
            {error && (
              <p className="text-body-sm text-muted-foreground" role="alert">
                {error}
              </p>
            )}
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

export { SkillFloorCheck }
