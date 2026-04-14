from dataclasses import dataclass, field
from typing import List, Optional
from pydantic import BaseModel


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
    name: str
    amount: float
    type: str
    date: str
    is_recurring: int = 0


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
    type: str
    monthly_limit: float


@dataclass
class Income:
    id: str
    name: str
    amount: float
    date: str
    created_at: str
    is_recurring: int = 0
    user_id: str = None


class NewIncome(BaseModel):
    name: str
    amount: float
    date: str
    is_recurring: int = 0


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
    name: str
    color: str
    icon: str
    macrocategory_id: Optional[str] = None


class NewMacrocategory(BaseModel):
    name: str
    color: str = '#a0a0a0'
    budget_limit: Optional[float] = None


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
    goal_type: str
    name: str
    target: Optional[float] = None
    deadline: Optional[str] = None
    color: Optional[str] = None
    allocation_pct: Optional[float] = None
    priority: Optional[int] = None
    months_target: Optional[int] = None


class UpdateSavingsGoal(BaseModel):
    name: str
    target: Optional[float] = None
    deadline: Optional[str] = None
    color: Optional[str] = None
    allocation_pct: Optional[float] = None
    priority: Optional[int] = None
    paused: bool = False
    months_target: Optional[int] = None


class NewContribution(BaseModel):
    amount: float
    date: str
    note: Optional[str] = None
    expense_id: Optional[str] = None  # link to an existing expense instead of creating a new one
