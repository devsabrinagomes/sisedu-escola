export type Alternativa = "A" | "B" | "C" | "D" | "E"

export type Subject = {
  id: number
  name: string
}

export type Topic = {
  id: number
  subject: number
  description: string
}

export type Descriptor = {
  id: number
  topic: number
  code: string
  name: string
}

export type Skill = {
  id: number
  descriptor: number
  code: string
  name: string
}

export type QuestionOption = {
  id: number
  letter: Alternativa
  option_text: string
  option_image?: string | null
  correct: boolean
}

export type QuestionVersion = {
  id: number
  question: number
  version_number: number
  title: string
  command: string
  support_text: string
  support_image?: string | null
  image_reference: string
  subject: number
  descriptor: number | null
  skill: number | null
  annulled: boolean
  created_at: string
  options?: QuestionOption[]
}

export type Question = {
  id: number
  private: boolean
  deleted: boolean
  created_by: number
  created_at: string
  subject_name?: string | null
  versions?: QuestionVersion[]
}
