"""Timezone helpers for India Standard Time (IST)."""
from __future__ import annotations

from datetime import date, datetime
from zoneinfo import ZoneInfo


IST = ZoneInfo("Asia/Kolkata")


def now_ist_naive() -> datetime:
    """Return current IST datetime without tzinfo for DB DateTime columns."""
    return datetime.now(IST).replace(tzinfo=None)


def today_ist() -> date:
    """Return current IST date."""
    return now_ist_naive().date()

