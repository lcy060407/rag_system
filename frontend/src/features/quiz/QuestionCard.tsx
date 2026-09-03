"use client";

import type { CSSProperties, ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import rehypeKatex from "rehype-katex";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import { MarkdownAnswer } from "@/components/chat/MarkdownAnswer";
import { RelatedImages } from "@/components/chat/RelatedImages";
import {
  QUIZ_DIFFICULTY_LABELS,
  QUIZ_TYPE_LABELS,
  type QuizChoice,
  type QuizQuestion,
  type QuizQuestionResult,
} from "./types";

type QuestionDisplay = Pick<
  QuizQuestion,
  | "id"
  | "question_type"
  | "difficulty"
  | "knowledge_point"
  | "prompt"
  | "choices"
  | "correct_choice_id"
  | "correct_choice_ids"
  | "standard_answers"
  | "reference_answer"
  | "scoring_points"
  | "explanation"
  | "source_message_ids"
  | "related_images"
>;

type QuestionCardProps = {
  question: QuestionDisplay;
  index: number;
  selectedChoiceId?: string;
  selectedChoiceIds?: string[];
  textAnswer?: string;
  result?: QuizQuestionResult;
  showAnswer?: boolean;
  isSavedToWrongBook?: boolean;
  onSelect?: (choiceId: string) => void;
  onToggleChoice?: (choiceId: string) => void;
  onTextChange?: (text: string) => void;
};

const CHOICE_TYPES = new Set(["single", "multi", "judge"]);
const SUBJECTIVE_TYPES = new Set(["calc", "short", "essay"]);

const badgeStyle: CSSProperties = {
  display: "inline-block",
  padding: "2px 10px",
  marginRight: 6,
  borderRadius: 999,
  fontSize: 12,
  background: "#eef3f1",
  color: "#2f5d50",
  border: "1px solid #d3e0da",
};

const textInputStyle: CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: 8,
  border: "1px solid #cfd8d3",
  fontSize: 14,
  fontFamily: "inherit",
  boxSizing: "border-box",
};

function normalizeMathDelimiters(content: string) {
  return content.replace(/\$\s+/g, "$").replace(/\s+\$/g, "$");
}

export function InlineMarkdown({ content }: { content: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm, remarkMath]}
      rehypePlugins={[[rehypeKatex, { strict: false, throwOnError: false }]]}
      components={{
        p: ({ children }: { children?: ReactNode }) => <span>{children}</span>,
      }}
    >
      {normalizeMathDelimiters(content)}
    </ReactMarkdown>
  );
}

export function QuestionCard({
  question,
  index,
  selectedChoiceId,
  selectedChoiceIds,
  textAnswer,
  result,
  showAnswer = false,
  isSavedToWrongBook,
  onSelect,
  onToggleChoice,
  onTextChange,
}: QuestionCardProps) {
  const questionType = question.question_type || "single";
  const isChoiceType = CHOICE_TYPES.has(questionType);
  const isSubjective = SUBJECTIVE_TYPES.has(questionType);
  const isAnswered = Boolean(result || showAnswer);
  const correctChoiceId = result?.correct_choice_id || question.correct_choice_id;
  const explanation = result?.explanation || question.explanation;
  const score = result?.score ?? null;
  const feedback = result?.grading_feedback;
  const saved =
    isSavedToWrongBook ??
    Boolean(
      result &&
        (result.is_correct === false ||
          (result.score != null && result.score < 60)),
    );

  return (
    <article className="quiz-question">
      {saved ? <div className="quiz-question-saved">已写入错题本</div> : null}

      <div style={{ marginBottom: 8 }}>
        <span style={badgeStyle}>{QUIZ_TYPE_LABELS[questionType] || "选择题"}</span>
        {question.difficulty ? (
          <span style={badgeStyle}>
            {QUIZ_DIFFICULTY_LABELS[question.difficulty] || question.difficulty}
          </span>
        ) : null}
        {question.knowledge_point ? (
          <span style={badgeStyle}>知识点：{question.knowledge_point}</span>
        ) : null}
      </div>

      <div className="quiz-question-prompt">
        <span className="quiz-question-number">{index + 1}</span>
        <MarkdownAnswer
          content={question.prompt}
          relatedImages={question.related_images}
        />
      </div>

      <SourceReferences sourceIds={question.source_message_ids} />
      <RelatedImages images={question.related_images} />

      {isChoiceType ? (
        <div className="quiz-choice-list">
          {question.choices.map((choice) => (
            <ChoiceButton
              key={choice.id}
              choice={choice}
              multi={questionType === "multi"}
              correctChoiceIds={
                questionType === "multi"
                  ? question.correct_choice_ids
                  : [correctChoiceId]
              }
              isAnswered={isAnswered}
              isSelected={
                questionType === "multi"
                  ? Boolean(selectedChoiceIds?.includes(choice.id))
                  : selectedChoiceId === choice.id
              }
              onSelect={questionType === "multi" ? onToggleChoice : onSelect}
            />
          ))}
        </div>
      ) : null}

      {questionType === "fill" && !isAnswered ? (
        <input
          style={textInputStyle}
          placeholder="填写答案（多个空用分号 ; 隔开）"
          value={textAnswer || ""}
          onChange={(event) => onTextChange?.(event.target.value)}
        />
      ) : null}

      {isSubjective && !isAnswered ? (
        <textarea
          style={{ ...textInputStyle, minHeight: 120, resize: "vertical" }}
          placeholder="在此作答，尽量写清关键步骤和要点"
          value={textAnswer || ""}
          onChange={(event) => onTextChange?.(event.target.value)}
        />
      ) : null}

      {isAnswered && questionType === "fill" ? (
        <div className="quiz-explanation">
          <p>
            <strong>你的答案：</strong>
            <InlineMarkdown
              content={result?.text_answer || textAnswer || "（未作答）"}
            />
            {result?.is_correct ? " ✅" : " ❌"}
          </p>
          <p>
            <strong>标准答案：</strong>
            {question.standard_answers.length ? (
              question.standard_answers.map((answer, answerIndex) => (
                <span key={answerIndex}>
                  {answerIndex > 0 ? "；" : ""}
                  <InlineMarkdown content={answer} />
                </span>
              ))
            ) : (
              "暂无"
            )}
          </p>
        </div>
      ) : null}

      {isAnswered && isSubjective ? (
        <div className="quiz-explanation">
          <p>
            <strong>你的答案：</strong>
            <InlineMarkdown
              content={result?.text_answer || textAnswer || "（未作答）"}
            />
          </p>
          {typeof score === "number" ? (
            <p>
              <strong>得分：{score} / 100</strong>
            </p>
          ) : null}
          {feedback?.matched_points?.length ? (
            <p>
              <strong>已覆盖要点：</strong>
              {feedback.matched_points.map((point, pointIndex) => (
                <span key={pointIndex}>
                  {pointIndex > 0 ? "；" : ""}
                  <InlineMarkdown content={point} />
                </span>
              ))}
            </p>
          ) : null}
          {feedback?.missed_points?.length ? (
            <p>
              <strong>遗漏要点：</strong>
              {feedback.missed_points.map((point, pointIndex) => (
                <span key={pointIndex}>
                  {pointIndex > 0 ? "；" : ""}
                  <InlineMarkdown content={point} />
                </span>
              ))}
            </p>
          ) : null}
          {feedback?.error_analysis ? (
            <p>
              <strong>错误分析：</strong>
              <InlineMarkdown content={feedback.error_analysis} />
            </p>
          ) : null}
          {feedback?.suggestion ? (
            <p>
              <strong>改进建议：</strong>
              <InlineMarkdown content={feedback.suggestion} />
            </p>
          ) : null}
          {question.reference_answer ? (
            <>
              <strong>参考答案</strong>
              <MarkdownAnswer
                content={question.reference_answer}
                relatedImages={question.related_images}
              />
            </>
          ) : null}
        </div>
      ) : null}

      {isAnswered ? (
        <div className="quiz-explanation">
          <strong>解析</strong>
          <MarkdownAnswer
            content={explanation || "暂无解析。"}
            relatedImages={question.related_images}
          />
        </div>
      ) : null}
    </article>
  );
}

function ChoiceButton({
  choice,
  multi,
  correctChoiceIds,
  isAnswered,
  isSelected,
  onSelect,
}: {
  choice: QuizChoice;
  multi: boolean;
  correctChoiceIds: string[];
  isAnswered: boolean;
  isSelected: boolean;
  onSelect?: (choiceId: string) => void;
}) {
  const isCorrect = isAnswered && correctChoiceIds.includes(choice.id);
  const isWrongSelection = isAnswered && isSelected && !isCorrect;
  const isMissed = isAnswered && multi && isCorrect && !isSelected;
  const resultLabel = isCorrect
    ? "正确答案"
    : isWrongSelection
      ? "你的选择"
      : "";
  const resultIcon = isCorrect ? "✓" : isWrongSelection ? "✕" : "";

  return (
    <button
      type="button"
      className={[
        "quiz-choice",
        isSelected ? "selected" : "",
        isCorrect ? "correct" : "",
        isWrongSelection ? "incorrect" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      disabled={isAnswered || !onSelect}
      onClick={() => onSelect?.(choice.id)}
    >
      <span className="quiz-choice-letter">{multi ? "☑" : choice.id}</span>
      <em>
        <InlineMarkdown content={choice.text} />
      </em>
      {resultLabel ? (
        <span className="quiz-choice-result">
          <strong aria-hidden="true">{resultIcon}</strong>
          {resultLabel}
          {isMissed ? "（漏选）" : ""}
        </span>
      ) : null}
    </button>
  );
}

function SourceReferences({ sourceIds }: { sourceIds: string[] }) {
  const labels = uniqueSourceLabels(sourceIds);
  if (!labels.length) return null;

  return (
    <div className="quiz-source-list" aria-label="题目引用来源">
      {labels.map((label) => (
        <span key={label}>{label}</span>
      ))}
    </div>
  );
}

function uniqueSourceLabels(sourceIds: string[]) {
  return Array.from(new Set(sourceIds.map(sourceLabelForId)));
}

function sourceLabelForId(sourceId: string) {
  if (sourceId.startsWith("wrong_")) return "引用错题记录";
  if (sourceId.startsWith("quiz_")) return "引用历史小测";
  if (sourceId.startsWith("learn_")) return "引用问答记录";
  if (sourceId.startsWith("mem_")) return "引用学习记忆";
  return "引用学习材料";
}

export function choiceText(
  question: Pick<QuestionDisplay, "choices">,
  choiceId: string,
) {
  return question.choices.find((choice) => choice.id === choiceId)?.text || choiceId;
}
