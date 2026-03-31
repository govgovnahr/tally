from dataclasses import dataclass, field
from typing import List
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
