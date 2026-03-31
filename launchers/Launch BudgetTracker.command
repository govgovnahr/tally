#!/bin/bash
DIR="$(cd "$(dirname "$0")" && pwd)"
xattr -cr "$DIR"
"$DIR/BudgetTracker"
