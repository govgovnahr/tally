import os
import json
import logging

logger = logging.getLogger("budget_app")


def get_openai_client():
    import openai
    return openai.OpenAI(api_key=os.environ["OPENAI_API_KEY"])


def ai_suggest_category(expense_name, amount, expense_types):
    """
    One-shot gpt-4o-mini call to categorize an expense by name and amount.
    Lives here rather than in ai_agent.py so the import pipeline can call it
    without pulling in the full LangGraph dependency tree.
    Returns {"category": str | None, "reasoning": str}.
    """
    if not os.environ.get("OPENAI_API_KEY"):
        return {"category": None, "reasoning": "OPENAI_API_KEY not configured"}

    type_list = ", ".join(expense_types)

    prompt = (
        "You are a personal finance assistant. Categorize the following expense "
        "using only the categories listed below.\n\n"
        "Expense: " + expense_name + "\n"
        "Amount: $" + str(round(amount, 2)) + "\n\n"
        "Available categories: " + type_list + "\n\n"
        "Reply with valid JSON only, no markdown:\n"
        "{\"category\": \"<exact category name from the list>\", \"reasoning\": \"<one sentence>\"}"
    )

    try:
        client = get_openai_client()
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
            temperature=0,
            max_tokens=120,
        )
        raw = response.choices[0].message.content.strip()

        # Strip markdown fences if the model wrapped the JSON despite instructions
        if raw.startswith("```"):
            parts = raw.split("```")
            raw = parts[1] if len(parts) > 1 else raw
            if raw.startswith("json"):
                raw = raw[4:]
        raw = raw.strip()

        result = json.loads(raw)
        return result
    except Exception as e:
        logger.warning("ai_suggest_category failed for '%s': %s", expense_name, str(e))
        return {"category": None, "reasoning": "AI categorization failed: " + str(e)}
