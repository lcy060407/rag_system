from __future__ import annotations

import json
from statistics import pstdev

from backend.storage.sqlite import metadata_connection

_TYPE_GROUPS = {
    "concept": ["single", "multi", "judge"],
    "compute": ["fill", "calc"],
    "express": ["short", "essay"],
}

_LABELS = {
    "concept": "概念理解",
    "compute": "计算能力",
    "express": "综合表达",
    "breadth": "知识广度",
    "stability": "答题稳定性",
    "followup": "错题跟进",
}


def _clamp(value: float) -> float:
    return max(0.0, min(100.0, value))


def compute_ability_radar() -> dict:
    with metadata_connection() as connection:
        attempts = connection.execute(
            """
            SELECT a.correct_count, a.total_count, s.questions_json
            FROM quiz_attempts a
            JOIN quiz_sessions s ON s.id = a.quiz_session_id
            """
        ).fetchall()
        wrong_rows = connection.execute(
            "SELECT question_type, knowledge_point, reviewed_at FROM wrong_questions"
        ).fetchall()

    total_by_type: dict[str, int] = {}
    wrong_by_type: dict[str, int] = {}
    knowledge_points: set[str] = set()
    accuracies: list[float] = []

    for row in attempts:
        total_count = row["total_count"] or 0
        if total_count > 0:
            accuracies.append((row["correct_count"] or 0) / total_count)
        try:
            questions = json.loads(row["questions_json"] or "[]")
        except json.JSONDecodeError:
            questions = []
        for question in questions:
            question_type = question.get("question_type") or "single"
            total_by_type[question_type] = total_by_type.get(question_type, 0) + 1
            point = (question.get("knowledge_point") or "").strip()
            if point:
                knowledge_points.add(point)

    for row in wrong_rows:
        question_type = row["question_type"] or "single"
        wrong_by_type[question_type] = wrong_by_type.get(question_type, 0) + 1

    def type_accuracy(types: list[str]) -> tuple[float | None, str]:
        total = sum(total_by_type.get(item, 0) for item in types)
        wrong = sum(wrong_by_type.get(item, 0) for item in types)
        if total == 0:
            return None, "暂无该题型的答题数据"
        correct = total - wrong
        return _clamp(correct / total * 100), f"{correct}/{total} 题正确"

    dimensions: list[dict] = []

    for key in ("concept", "compute", "express"):
        value, detail = type_accuracy(_TYPE_GROUPS[key])
        dimensions.append({"key": key, "label": _LABELS[key], "value": value, "detail": detail})

    breadth = _clamp(len(knowledge_points) * 10) if knowledge_points else None
    dimensions.append({
        "key": "breadth",
        "label": _LABELS["breadth"],
        "value": breadth,
        "detail": f"已覆盖 {len(knowledge_points)} 个知识点" if knowledge_points else "暂无知识点数据",
    })

    if len(accuracies) >= 2:
        stability = _clamp(100 - pstdev(accuracies) * 300)
        dimensions.append({
            "key": "stability",
            "label": _LABELS["stability"],
            "value": stability,
            "detail": f"共提交 {len(accuracies)} 次小测",
        })
    elif accuracies:
        dimensions.append({
            "key": "stability",
            "label": _LABELS["stability"],
            "value": 70.0,
            "detail": "仅 1 次小测，暂按 70 分估算",
        })
    else:
        dimensions.append({"key": "stability", "label": _LABELS["stability"], "value": None, "detail": "暂无小测数据"})

    wrong_total = len(wrong_rows)
    if wrong_total:
        reviewed = sum(1 for row in wrong_rows if row["reviewed_at"])
        dimensions.append({
            "key": "followup",
            "label": _LABELS["followup"],
            "value": _clamp(reviewed / wrong_total * 100),
            "detail": f"已复习 {reviewed}/{wrong_total} 道错题",
        })
    else:
        dimensions.append({"key": "followup", "label": _LABELS["followup"], "value": None, "detail": "暂无错题记录"})

    return {
        "dimensions": dimensions,
        "total_questions": sum(total_by_type.values()),
        "total_wrong": wrong_total,
        "total_attempts": len(accuracies),
    }
