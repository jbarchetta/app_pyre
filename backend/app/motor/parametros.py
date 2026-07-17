from sqlalchemy.orm import Session

from app.models import ParametroCalculo


def obtener_parametros(db: Session) -> ParametroCalculo:
    parametros = db.query(ParametroCalculo).first()
    if parametros is None:
        parametros = ParametroCalculo()
        db.add(parametros)
        db.commit()
        db.refresh(parametros)
    return parametros
