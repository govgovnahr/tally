from dataclasses import dataclass, field
from datetime import date as _date
from typing import List, Literal, Optional
from pydantic import BaseModel, Field, field_validator


def _valid_date(v: Optional[str]) -> Optional[str]:
    if v is None:
        return None
    try:
        _date.fromisoformat(v)
    except (ValueError, TypeError):
        raise ValueError("date must be YYYY-MM-DD")
    return v


def _valid_color(v: Optional[str]) -> Optional[str]:
    import re
    if v is not None and not re.match(r'^#[0-9a-fA-F]{6}$', v):
        raise ValueError("color must be a 6-digit hex string e.g. #a1b2c3")
    return v


def _valid_cycle_day(v: Optional[int]) -> Optional[int]:
    if v is not None and not (1 <= v <= 31):
        raise ValueError("cycle_start_day must be between 1 and 31")
    return v


@dataclass
class Expense:
    id: str
    name: str
    amount: float
    type: str
    date: str
    created_at: str
    is_recurring: int = 0


@dataclass
class Expenses:
    expenses: List[Expense]


class NewExpense(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    amount: float = Field(gt=0, le=100_000_000)
    type: str = Field(min_length=1, max_length=100)
    date: str
    is_recurring: int = Field(0, ge=0, le=1)

    _vdate = field_validator("date")(_valid_date)


@dataclass
class TypeSummary:
    type: str
    total: float
    count: int


@dataclass
class Budget:
    type: str
    monthly_limit: float


class NewBudget(BaseModel):
    type: str = Field(min_length=1, max_length=100)
    monthly_limit: float = Field(ge=0, le=100_000_000)


@dataclass
class Income:
    id: str
    name: str
    amount: float
    date: str
    created_at: str
    is_recurring: int = 0
    user_id: str = None
    credit_type: str = None


class NewIncome(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    amount: float = Field(gt=0, le=100_000_000)
    date: str
    is_recurring: int = Field(0, ge=0, le=1)
    credit_type: Optional[str] = Field(None, max_length=100)

    _vdate = field_validator("date")(_valid_date)


@dataclass
class ExpenseType:
    id: str
    name: str
    color: str
    icon: str
    sort_order: int
    is_default: int
    user_id: str = None


class NewExpenseType(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    color: str
    icon: str = Field(min_length=1, max_length=50)
    macrocategory_id: Optional[str] = None

    _vcolor = field_validator("color")(_valid_color)


class NewMacrocategory(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    color: str = '#a0a0a0'
    budget_limit: Optional[float] = Field(None, ge=0, le=100_000_000)

    _vcolor = field_validator("color")(_valid_color)


@dataclass
class SavingsGoal:
    id: str
    goal_type: str
    name: str
    target: float
    deadline: Optional[str]
    created_at: str
    color: Optional[str] = None
    allocation_pct: Optional[float] = None
    priority: Optional[int] = None
    paused: bool = False
    monthly_contributions: Optional[float] = None
    current_net: Optional[float] = None
    effective_net: Optional[float] = None
    cumulative_net: Optional[float] = None
    effective_progress: Optional[float] = None
    progress_pct: float = 0.0
    avg_monthly_net: Optional[float] = None
    effective_avg_monthly_net: Optional[float] = None
    projected_completion: Optional[str] = None
    total_contributions: float = 0.0
    contributions: list = field(default_factory=list)


@dataclass
class SavingsContribution:
    id: str
    goal_id: str
    amount: float
    date: str
    note: Optional[str]
    created_at: str


class NewSavingsGoal(BaseModel):
    goal_type: Literal['monthly', 'one_time', 'emergency_fund']
    name: str = Field(min_length=1, max_length=200)
    target: Optional[float] = Field(None, gt=0, le=100_000_000)
    deadline: Optional[str] = None
    color: Optional[str] = None
    allocation_pct: Optional[float] = Field(None, gt=0, le=100)
    priority: Optional[int] = Field(None, ge=1)
    months_target: Optional[int] = Field(None, ge=1)

    _vdeadline = field_validator("deadline")(_valid_date)
    _vcolor = field_validator("color")(_valid_color)


class UpdateSavingsGoal(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    target: Optional[float] = Field(None, gt=0, le=100_000_000)
    deadline: Optional[str] = None
    color: Optional[str] = None
    allocation_pct: Optional[float] = Field(None, gt=0, le=100)
    priority: Optional[int] = Field(None, ge=1)
    paused: bool = False
    months_target: Optional[int] = Field(None, ge=1)

    _vdeadline = field_validator("deadline")(_valid_date)
    _vcolor = field_validator("color")(_valid_color)


class NewContribution(BaseModel):
    amount: float = Field(gt=0, le=100_000_000)
    date: str
    note: Optional[str] = Field(None, max_length=500)
    expense_id: Optional[str] = None

    _vdate = field_validator("date")(_valid_date)


class ChatMessage(BaseModel):
    role: str = Field(pattern="^(user|assistant)$")
    content: str = Field(min_length=1, max_length=10_000)


class ChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=5000)
    history: List[ChatMessage] = Field(default_factory=list, max_length=40)


class ChatResponse(BaseModel):
    reply: str
    history: List[ChatMessage]
    tool_steps: List[str] = Field(default_factory=list)


class SettingsUpdate(BaseModel):
    ai_enabled: Optional[bool] = None
    cycle_start_day: Optional[int] = None
    seen_category_migration_notice: Optional[bool] = None

    _vcycle = field_validator("cycle_start_day")(_valid_cycle_day)
