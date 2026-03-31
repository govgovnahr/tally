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


@dataclass
class Expenses:
    expenses: List[Expense]


class NewExpense(BaseModel):
    name: str
    amount: float
    type: str
    date: str


@dataclass
class TypeSummary:
    type: str
    total: float
    count: int
