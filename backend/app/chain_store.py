"""SQLite persistence for the chain state."""

import json
import time
from typing import Optional

from sqlalchemy.exc import OperationalError

from app.database import SessionLocal
from app.models import ChainStateModel
from app.blockchain.chain import Blockchain


def save_chain(chain: Blockchain) -> None:
    payload = json.dumps(chain.to_dict(), sort_keys=True)
    last_error = None
    for _ in range(5):
        db = SessionLocal()
        try:
            row = db.query(ChainStateModel).filter(ChainStateModel.id == 1).first()
            if row:
                row.data = payload
            else:
                db.add(ChainStateModel(id=1, data=payload))
            db.commit()
            return
        except OperationalError as exc:
            db.rollback()
            last_error = exc
            time.sleep(0.1)
        finally:
            db.close()
    raise last_error


def load_chain() -> Optional[Blockchain]:
    db = SessionLocal()
    try:
        row = db.query(ChainStateModel).filter(ChainStateModel.id == 1).first()
        if not row:
            return None
        return Blockchain.from_dict(json.loads(row.data), persist_callback=save_chain)
    finally:
        db.close()
