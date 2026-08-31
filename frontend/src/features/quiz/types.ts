import type { RelatedImage } from "@/types/chat";

export type QuizChoice = {
  id: string;
  text: string;
};

export type QuizQuestionType =
  | "single"
  | "multi"
  | "judge"
  | "fill"
  | "calc"
  | "short"
  | "essay";

export const QUIZ_TYPE_LABELS: Record<QuizQuestionType, string> = {
  single: "单选题",
  multi: "多选题",
  judge: "判断题",
  fill: "填空题",
  calc: "计算题",
  short: "简答题",
  essay: "论述题",
};

export const QUIZ_DIFFICULTY_LABELS: Record<string, string> = {
  easy: "基础",
  medium: "进阶",
  hard: "挑战",
};

export type QuizQuestion = {
  id: string;
  question_type: QuizQuestionType;
  difficulty: string;
  knowledge_point: string;
  prompt: string;
  choices: QuizChoice[];
  correct_choice_id: string;
  correct_choice_ids: string[];
  standard_answers: string[];
  reference_answer: string;
  scoring_points: string[];
  explanation: string;
  source_message_ids: string[];
  related_images: RelatedImage[];
};

export type QuizSession = {
  id: string;
  profile_id: string;
  conversation_id: string;
  title: string;
  questions: QuizQuestion[];
  created_at: string;
};

export type QuizGenerateOptions = {
  conversationId?: string | null;
  documentIds?: string[];
  questionTypes?: QuizQuestionType[];
  difficulty?: string;
  count?: number;
};

export type QuizSubmitAnswer = {
  question_id: string;
  selected_choice_id?: string | null;
  selected_choice_ids?: string[];
  text_answer?: string | null;
};

export type QuizGradingFeedback = {
  score?: number | null;
  matched_points?: string[];
  missed_points?: string[];
  error_analysis?: string;
  suggestion?: string;
};

export type QuizQuestionResult = {
  question: QuizQuestion;
  selected_choice_id?: string | null;
  selected_choice_ids?: string[];
  text_answer?: string | null;
  is_correct?: boolean | null;
  score?: number | null;
  correct_choice_id: string;
  explanation: string;
  grading_feedback?: QuizGradingFeedback;
};

export type QuizSubmitResponse = {
  session_id: string;
  correct_count: number;
  total_count: number;
  total_score?: number | null;
  results: QuizQuestionResult[];
};

export type WrongQuestion = {
  id: string;
  profile_id: string;
  quiz_session_id: string;
  conversation_id: string;
  question_id: string;
  question_type: QuizQuestionType;
  difficulty: string;
  knowledge_point: string;
  prompt: string;
  choices: QuizChoice[];
  selected_choice_id: string;
  correct_choice_id: string;
  text_answer?: string | null;
  score?: number | null;
  explanation: string;
  source_message_ids: string[];
  related_images: RelatedImage[];
  created_at: string;
  reviewed_at?: string | null;
};
