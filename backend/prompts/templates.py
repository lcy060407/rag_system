from __future__ import annotations

ANSWER_LEVELS = {
    "beginner": (
        "使用日常中文、短句和直观类比；减少术语密度，必要公式后置，"
        "并解释符号含义。"
    ),
    "undergraduate": (
        "使用本科生可理解的中文；可以使用常见术语、公式和推导步骤，"
        "但要解释关键条件。"
    ),
    "expert": (
        "使用精确、紧凑的专业中文；可以直接使用术语、公式、边界条件和严格表述。"
    ),
    "custom": "遵循用户在 Profile / AGENTS.md 中配置的语言难度、风格和输出偏好。",
}


ANSWER_LEVEL_LABELS = {
    "beginner": "入门",
    "undergraduate": "本科",
    "expert": "专家",
    "custom": "自定义",
}


BUILTIN_AGENTS_MD = {
    "beginner": """# AGENTS.md

## 难度：入门
只调整回答语言难度，不改变用户任务。
- 不要对用户输入做任务分类。
- 不要把用户问题改写成总结、出题、讲解或其他模板。
- 用户怎么问，就按原问题直接回答。
- 使用日常中文、短句和直观类比。
- 少用术语；必须使用术语时先解释。
- 必要公式可以出现，但要放慢节奏解释符号和含义。
- 只基于文档内容回答；信息不足时直接说明。
""",
    "undergraduate": """# AGENTS.md

## 难度：本科
只调整回答语言难度，不改变用户任务。
- 不要对用户输入做任务分类。
- 不要把用户问题改写成总结、出题、讲解或其他模板。
- 用户怎么问，就按原问题直接回答。
- 使用本科生可理解的中文。
- 可以使用常见术语、公式和推导步骤，但要解释关键条件。
- 如果用户指定数量、格式或范围，按用户原文要求执行。
- 只基于文档内容回答；信息不足时直接说明。
""",
    "expert": """# AGENTS.md

## 难度：专家
只调整回答语言难度，不改变用户任务。
- 不要对用户输入做任务分类。
- 不要把用户问题改写成总结、出题、讲解或其他模板。
- 用户怎么问，就按原问题直接回答。
- 使用精确、紧凑的专业中文。
- 可以直接使用术语、公式、边界条件和严格表述。
- 如果用户指定数量、格式或范围，按用户原文要求执行。
- 只基于文档内容回答；信息不足时直接说明。
""",
}


CUSTOM_AGENTS_MD_DEFAULT = """# AGENTS.md

只调整回答语言难度和表达风格，不改变用户任务。
- 不要对用户输入做任务分类。
- 不要把用户问题改写成总结、出题、讲解或其他模板。
- 用户怎么问，就按原问题直接回答。
- 如果我指定数量、格式或范围，按我的原文要求执行。
- 只基于文档内容回答；信息不足时直接说明。
"""


def normalize_answer_level(level: str) -> str:
    return level if level in ANSWER_LEVELS else "undergraduate"


def agents_md_for_level(level_key: str, custom_agents_md: str | None = None) -> str:
    if level_key == "custom":
        return (custom_agents_md or CUSTOM_AGENTS_MD_DEFAULT).strip()
    return BUILTIN_AGENTS_MD.get(level_key, BUILTIN_AGENTS_MD["undergraduate"]).strip()


def level_guidance(level_key: str, level_prompt: str) -> str:
    level_label = ANSWER_LEVEL_LABELS.get(level_key, ANSWER_LEVEL_LABELS["undergraduate"])
    return (
        f"当前回答深度：{level_label}。{level_prompt} "
        "注意：回答深度只影响语言复杂度、术语密度和解释颗粒度，"
        "不得改变用户任务、题目数量、输出格式或问题范围。"
    )


def profile_prompt_prefix(profile_prompt: str | None) -> str:
    prompt = (profile_prompt or "").strip()
    if not prompt:
        return ""
    return (
        "【Profile / Memory 个性化上下文】\n"
        "以下内容来自用户维护的 Profile 和人工确认的 Memory。"
        "它只用于调整语言难度、表达风格、输出偏好和学习连续性。"
        "不得用它对用户输入做任务分类，不得覆盖本轮用户原始问题。"
        "如果它与本轮问题冲突，以本轮问题为准；"
        "如果它与检索文档事实冲突，以检索文档事实为准。\n\n"
        f"{prompt}\n"
        "【Profile / Memory 个性化上下文结束】\n\n"
    )


def build_task_system_prompt(profile_prompt: str | None = None) -> str:
    return (
        profile_prompt_prefix(profile_prompt)
        + "你是一名中文 RAG 助教。不要对用户输入做任务分类，"
        "不要根据分类套用任何专用模板。用户怎么问，就按用户原始问题直接回答；"
        "如果用户指定数量、格式或范围，严格按原文执行。"
        "回答只能基于检索到的文档内容；信息不足时直接说明。"
        "难度选项只控制语言复杂度、术语密度和解释颗粒度，不改变用户任务。"
    )


def build_document_prompt(
    question: str,
    document_id: str,
    level_key: str,
    level_prompt: str,
    profile_prompt: str | None = None,
    for_synthesis: bool = False,
) -> str:
    del profile_prompt
    scoped_context = (
        f"当前选中文档是：{document_id}。\n"
        "检索范围：document。\n"
        "你只能基于该文档的检索结果回答。"
        "如果检索结果不足，请说明“当前文档中没有足够信息”，不要引用其他文档。"
    )
    inline_image_rules = (
        "回答必须使用 Markdown。\n"
        "如果上下文提供了图片引用 ID，且某段解释依赖对应图片，"
        "请在该段后插入真实图片 ID，例如 [[image:012345abcdef012345abcdef012345abcdef012345abcdef012345abcdef0123]]。\n"
        "每张图最多引用一次；不要在答案末尾堆全部图片；不要输出本地文件路径；"
        "不要输出字面量 image_id；不要编造 image_id；只能使用上下文明示提供的真实图片 ID。"
    )
    if for_synthesis:
        response_rule = (
            "当前是多文档回答的单文档检索阶段。不要尝试完成最终跨文档回答，"
            "也不要因为用户问题提到多个文档就判定当前文档信息不足。"
            "请提取当前文档中能支持最终回答的事实、概念、公式、例子、图表线索和可引用依据；"
            "如果当前文档确实没有相关内容，再说明信息不足。"
        )
    else:
        response_rule = (
            "按用户原始问题本身要求输出。不要新增用户没有要求的任务结构。"
        )

    return (
        f"{scoped_context}\n\n"
        "用户原始问题如下。不要分类、不要改写、不要替换成内置任务模板：\n"
        f"{question}\n\n"
        f"语言难度：{level_guidance(level_key, level_prompt)}\n\n"
        f"回答规则：{response_rule}\n\n"
        f"图片引用规则：{inline_image_rules}"
    )
# ============================================================
# Quiz 多题型出题与评分模板
# ============================================================

QUIZ_TYPE_INSTRUCTIONS = {
    "single": (
        "生成单选题：4 个选项（A、B、C、D），correct_choice_id 为唯一正确项。"
    ),
    "multi": (
        "生成多选题：4-5 个选项，correct_choice_ids 包含 2-3 个正确项，"
        "explanation 要逐项说明每个选项为什么对或错。"
    ),
    "judge": (
        "生成判断题：choices 固定为 [{\"id\": \"A\", \"text\": \"正确\"}, "
        "{\"id\": \"B\", \"text\": \"错误\"}]，correct_choice_id 为 A 或 B。"
    ),
    "fill": (
        "生成填空题：题干中用 【1】【2】 标记空位；standard_answers 按空位顺序给出"
        "标准答案，每个空位可包含多个可接受的同义表述，用 | 分隔。"
    ),
    "calc": (
        "生成计算题：题干给出已知条件和求解目标；reference_answer 写完整解题步骤；"
        "scoring_points 按步骤拆分得分点（例如：正确列出公式、正确代入数值、"
        "计算结果正确）。"
    ),
    "short": (
        "生成简答题：reference_answer 给出 150 字以内的参考答案；"
        "scoring_points 列出 3-5 个得分要点。"
    ),
    "essay": (
        "生成论述题：要求综合分析或知识迁移；reference_answer 给出答题框架；"
        "scoring_points 按论点维度拆分。"
    ),
}

DIFFICULTY_INSTRUCTIONS = {
    "easy": "考查记忆与概念识别，答案可直接在材料中找到。",
    "medium": "考查理解与应用，需要对材料做一步推理或套用公式。",
    "hard": "考查分析与综合，需要结合多个知识点或辨析易混淆概念。",
}

VALID_QUIZ_TYPES = tuple(QUIZ_TYPE_INSTRUCTIONS.keys())
VALID_DIFFICULTIES = ("easy", "medium", "hard", "mixed")

QUIZ_JSON_FORMAT = """
返回 JSON（不要输出 Markdown 代码块标记），格式为：
{
  "questions": [
    {
      "question_type": "题型，必须是要求的题型之一",
      "difficulty": "easy/medium/hard",
      "knowledge_point": "该题考查的知识点名称",
      "prompt": "题干",
      "choices": [{"id": "A", "text": "选项"}],   // 仅选择/判断题
      "correct_choice_id": "A",                    // 仅单选/判断题
      "correct_choice_ids": ["A", "C"],            // 仅多选题
      "standard_answers": ["答案1|同义表述"],        // 仅填空题
      "reference_answer": "参考答案",               // 仅计算/简答/论述题
      "scoring_points": ["得分点1", "得分点2"],      // 仅计算/简答/论述题
      "explanation": "解析",
      "source_message_ids": ["材料id"]
    }
  ]
}
不涉及的字段填空值：字符串填空串 ""，列表填空列表 []。
"""

def build_quiz_prompt(
    material: str,
    count: int,
    question_types: list[str] | None = None,
    difficulty: str = "mixed",
) -> str:
    """拼装多题型出题 prompt，供 quiz_service 调用。"""
    types = [t for t in (question_types or ["single"]) if t in QUIZ_TYPE_INSTRUCTIONS]
    if not types:
        types = ["single"]

    type_lines = "\n".join(
        f"- {QUIZ_TYPE_INSTRUCTIONS[t]}" for t in types
    )
    if difficulty in DIFFICULTY_INSTRUCTIONS:
        difficulty_line = DIFFICULTY_INSTRUCTIONS[difficulty]
    else:
        difficulty_line = (
            "混合难度：" + "；".join(DIFFICULTY_INSTRUCTIONS.values())
        )

    return f"""
请基于下面的学习材料，生成 {count} 道中文练习题，用于检查用户是否理解这些材料。

题型要求（{"、".join(types)}）：
{type_lines}

难度要求：
{difficulty_line}

通用要求：
- 优先考查历史学习回答、历史 quiz 记录和错题记录中涉及的知识点、结论、条件、推理或易错点。
- 只考查学习材料中已经出现的信息，不引入外部事实。
- 不要考查用户要求生成几道题、输出格式、用户偏好、界面设置、操作习惯、记忆状态或本系统功能。
- 如果材料来自历史 quiz 或错题记录，应围绕其中的学科知识重新出题，不要考"这条历史记录写了什么"。
- explanation 要说明正确答案为什么对，并指出它对应的材料依据。
- source_message_ids 只能使用学习材料中出现过的 id。
{QUIZ_JSON_FORMAT}
学习材料：
{material}
""".strip()


SUBJECTIVE_GRADING_PROMPT = """
你是严格但公正的中文助教。请根据评分要点为学生答案打分。

题目：{prompt}
参考答案：{reference_answer}
评分要点：{scoring_points}
学生答案：{student_answer}

要求：
- 逐条判断每个评分要点是否被覆盖；允许同义表达，不要求逐字一致。
- 指出学生答案中的错误之处，并给出一句具体的改进建议。
- score 为 0-100 的整数，按评分要点覆盖比例给分。

返回 JSON（不要输出 Markdown 代码块标记）：
{{
  "score": 0,
  "matched_points": ["已覆盖的要点"],
  "missed_points": ["未覆盖的要点"],
  "error_analysis": "错误分析",
  "suggestion": "改进建议"
}}
""".strip()
