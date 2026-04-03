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
