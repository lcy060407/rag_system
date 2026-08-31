"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { loadConversations } from "@/lib/conversationStorage";
import type { Conversation } from "@/types/chat";
import { quizApi } from "./api";
import { QuestionCard } from "./QuestionCard";
import {
  QUIZ_TYPE_LABELS,
  type QuizQuestion,
  type QuizQuestionType,
  type QuizSession,
  type QuizSubmitResponse,
} from "./types";

type AnswerDraft = {
  choiceId?: string;
  choiceIds?: string[];
  text?: string;
};

const ALL_TYPES: QuizQuestionType[] = [
  "single",
  "multi",
  "judge",
  "fill",
  "calc",
  "short",
  "essay",
];

const DIFFICULTY_OPTIONS = [
  { value: "mixed", label: "混合难度" },
  { value: "easy", label: "基础" },
  { value: "medium", label: "进阶" },
  { value: "hard", label: "挑战" },
];

function isAnswered(question: QuizQuestion, draft?: AnswerDraft) {
  if (!draft) return false;
  if (question.question_type === "multi") {
    return Boolean(draft.choiceIds?.length);
  }
  if (question.question_type === "single" || question.question_type === "judge") {
    return Boolean(draft.choiceId);
  }
  return Boolean(draft.text?.trim());
}

export function QuizPracticePage() {
  const searchParams = useSearchParams();
  const conversationId = searchParams.get("conversationId") || "";
  const shouldAutoStart = searchParams.get("auto") === "1";
  const autoStartedRef = useRef(false);

  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [isContextReady, setIsContextReady] = useState(false);
  const [session, setSession] = useState<QuizSession | null>(null);
  const [answers, setAnswers] = useState<Record<string, AnswerDraft>>({});
  const [result, setResult] = useState<QuizSubmitResponse | null>(null);
  const [wrongRecordCount, setWrongRecordCount] = useState<number | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [selectedTypes, setSelectedTypes] = useState<QuizQuestionType[]>([
    "single",
    "judge",
    "fill",
  ]);
  const [difficulty, setDifficulty] = useState("mixed");
  const [count, setCount] = useState(5);

  const canSubmit = Boolean(
    session &&
      !result &&
      session.questions.every((question) =>
        isAnswered(question, answers[question.id]),
      ),
  );
  const resultByQuestionId = useMemo(() => {
    return new Map(result?.results.map((item) => [item.question.id, item]) ?? []);
  }, [result]);

  useEffect(() => {
    const conversations = loadConversations();
    const matchedConversation =
      conversations.find((item) => item.id === conversationId) ||
      conversations[0] ||
      null;
    setConversation(matchedConversation);
    setIsContextReady(true);
  }, [conversationId]);

  const loadWrongRecordCount = useCallback(async () => {
    try {
      const wrongQuestions = await quizApi.wrongQuestions(null);
      setWrongRecordCount(wrongQuestions.length);
    } catch {
      setWrongRecordCount(null);
    }
  }, []);

  const generateQuiz = useCallback(async () => {
    if (isGenerating) return;
    setIsGenerating(true);
    setError("");
    setNotice("");
    setResult(null);
    setAnswers({});
    try {
      const nextSession = await quizApi.generate({
        conversationId: conversation?.id,
        documentIds: conversation?.documentIds,
        questionTypes: selectedTypes,
        difficulty,
        count,
      });
      setSession(nextSession);
    } catch (nextError) {
      setError(formatQuizError(nextError));
    } finally {
      setIsGenerating(false);
    }
  }, [conversation, isGenerating, selectedTypes, difficulty, count]);

  useEffect(() => {
    void loadWrongRecordCount();
  }, [loadWrongRecordCount]);

  useEffect(() => {
    if (!isContextReady || !shouldAutoStart || autoStartedRef.current) return;
    autoStartedRef.current = true;
    void generateQuiz();
  }, [generateQuiz, isContextReady, shouldAutoStart]);

  function toggleType(type: QuizQuestionType) {
    setSelectedTypes((current) => {
      if (current.includes(type)) {
        return current.length > 1 ? current.filter((item) => item !== type) : current;
      }
      return [...current, type];
    });
  }

  async function submitQuiz() {
    if (!session || isSubmitting) return;
    setIsSubmitting(true);
    setError("");
    setNotice("");
    try {
      const response = await quizApi.submit(
        session.id,
        session.questions.map((question) => {
          const draft = answers[question.id] || {};
          if (question.question_type === "multi") {
            return {
              question_id: question.id,
              selected_choice_ids: draft.choiceIds || [],
            };
          }
          if (
            question.question_type === "single" ||
            question.question_type === "judge"
          ) {
            return {
              question_id: question.id,
              selected_choice_id: draft.choiceId || null,
            };
          }
          return {
            question_id: question.id,
            text_answer: draft.text || "",
          };
        }),
      );
      const wrongCount = response.results.filter(
        (item) =>
          item.is_correct === false ||
          (item.score != null && item.score < 60),
      ).length;
      setResult(response);
      setNotice(
        wrongCount
          ? `${wrongCount} 道错题已写入错题本，后续相关出题会引用这些错题记录。`
          : "本次作答情况良好，没有新增错题记录。",
      );
      void loadWrongRecordCount();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "提交失败。");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="study-page quiz-practice-page">
      <section className="study-main">
        <div className="study-page-heading">
          <div>
            <p className="section-label">一键出题</p>
            <h2>做题练习</h2>
            <p>{contextText(conversation)}</p>
          </div>
          <div className="study-heading-actions">
            <Link className="button button-ghost" href="/">
              返回问答
            </Link>
            <Link className="button button-secondary" href="/wrong-book">
              错题本
            </Link>
          </div>
        </div>

        {error ? <p className="message-feedback-error">{error}</p> : null}
        {notice ? <p className="chat-status">{notice}</p> : null}

        <div className="quiz-practice-toolbar" style={{ flexWrap: "wrap", gap: 8 }}>
          <span style={{ fontSize: 13, color: "#5b6b63" }}>题型：</span>
          {ALL_TYPES.map((type) => {
            const active = selectedTypes.includes(type);
            return (
              <button
                key={type}
                type="button"
                onClick={() => toggleType(type)}
                style={{
                  padding: "4px 12px",
                  borderRadius: 999,
                  fontSize: 13,
                  cursor: "pointer",
                  border: active ? "1px solid #2f5d50" : "1px solid #cfd8d3",
                  background: active ? "#2f5d50" : "#ffffff",
                  color: active ? "#ffffff" : "#33413a",
                }}
              >
                {QUIZ_TYPE_LABELS[type]}
              </button>
            );
          })}
          <select
            value={difficulty}
            onChange={(event) => setDifficulty(event.target.value)}
            style={{
              padding: "4px 10px",
              borderRadius: 8,
              border: "1px solid #cfd8d3",
              fontSize: 13,
            }}
          >
            {DIFFICULTY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <select
            value={count}
            onChange={(event) => setCount(Number(event.target.value))}
            style={{
              padding: "4px 10px",
              borderRadius: 8,
              border: "1px solid #cfd8d3",
              fontSize: 13,
            }}
          >
            {[3, 5, 8, 10].map((value) => (
              <option key={value} value={value}>
                {value} 题
              </option>
            ))}
          </select>
          <Button
            type="button"
            variant="primary"
            disabled={isGenerating}
            onClick={() => void generateQuiz()}
          >
            {isGenerating ? "正在出题..." : session ? "重新出题" : "开始出题"}
          </Button>
          {result ? (
            <strong>
              客观题 {result.correct_count}/{result.total_count} 正确
              {typeof result.total_score === "number"
                ? ` · 主观题均分 ${result.total_score}`
                : ""}
            </strong>
          ) : null}
        </div>

        {!session && !isGenerating ? (
          <p className="empty-state quiz-empty-state">
            选择题型和难度后点击开始出题，会基于当前对话、历史小测和错题记录生成练习题。
          </p>
        ) : null}
        {isGenerating ? (
          <p className="empty-state quiz-empty-state">正在基于学习记录生成题目...</p>
        ) : null}

        {session ? (
          <div className="quiz-session quiz-practice-session">
            <div className="quiz-session-heading">
              <strong>{session.title}</strong>
              <span>{session.questions.length} 题</span>
            </div>
            {session.questions.map((question, index) => {
              const questionResult = resultByQuestionId.get(question.id);
              const draft = answers[question.id] || {};
              return (
                <QuestionCard
                  key={question.id}
                  question={question}
                  index={index}
                  selectedChoiceId={
                    draft.choiceId ||
                    questionResult?.selected_choice_id ||
                    undefined
                  }
                  selectedChoiceIds={
                    draft.choiceIds || questionResult?.selected_choice_ids || []
                  }
                  textAnswer={
                    draft.text ?? questionResult?.text_answer ?? undefined
                  }
                  result={questionResult}
                  onSelect={(choiceId) =>
                    setAnswers((current) => ({
                      ...current,
                      [question.id]: { ...current[question.id], choiceId },
                    }))
                  }
                  onToggleChoice={(choiceId) =>
                    setAnswers((current) => {
                      const existing = current[question.id]?.choiceIds || [];
                      const next = existing.includes(choiceId)
                        ? existing.filter((item) => item !== choiceId)
                        : [...existing, choiceId];
                      return {
                        ...current,
                        [question.id]: { ...current[question.id], choiceIds: next },
                      };
                    })
                  }
                  onTextChange={(text) =>
                    setAnswers((current) => ({
                      ...current,
                      [question.id]: { ...current[question.id], text },
                    }))
                  }
                />
              );
            })}
            <div className="quiz-submit-row quiz-practice-submit">
              <Button
                type="button"
                variant="primary"
                disabled={!canSubmit || isSubmitting}
                onClick={() => void submitQuiz()}
              >
                {isSubmitting ? "判分中..." : result ? "已提交" : "提交答案"}
              </Button>
            </div>
          </div>
        ) : null}
      </section>

      <aside className="study-side" aria-label="小测记录说明">
        <section className="panel">
          <p className="section-label">记录引用</p>
          <h2>学习闭环</h2>
          <dl className="study-stat-list">
            <div>
              <dt>当前错题记录</dt>
              <dd>{wrongRecordCount === null ? "未加载" : `${wrongRecordCount} 题`}</dd>
            </div>
            <div>
              <dt>本次题量</dt>
              <dd>{count} 题</dd>
            </div>
          </dl>
          <p className="quiz-hint">
            客观题自动判分；主观题由 AI 按评分要点打分并给出改进建议。错题会进入错题本，
            后续出题会优先围绕薄弱点。
          </p>
        </section>
      </aside>
    </div>
  );
}

function contextText(conversation: Conversation | null) {
  if (!conversation) {
    return "未绑定当前对话，将使用可用的学习历史、历史小测和错题记录。";
  }
  if (!conversation.documentNames.length) {
    return `当前对话：${conversation.title}`;
  }
  return `当前对话：${conversation.title} · ${conversation.documentNames.join("、")}`;
}

function formatQuizError(error: unknown) {
  const message = error instanceof Error ? error.message : "出题失败。";
  if (/not found/i.test(message)) {
    return "小测验接口未找到。请重启 FastAPI 后端，让新的 quiz API 生效。";
  }
  return message || "出题失败。";
}
