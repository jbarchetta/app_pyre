from sqlalchemy import text

from app.database import engine


def test_database_connection_executes_select_1():
    with engine.connect() as conn:
        result = conn.execute(text("SELECT 1"))
        assert result.scalar() == 1
