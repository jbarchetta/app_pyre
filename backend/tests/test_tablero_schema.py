from sqlalchemy import inspect

from app.database import engine


def test_salida_tiene_columna_tipo_proteccion():
    inspector = inspect(engine)
    columns = {c["name"] for c in inspector.get_columns("salida")}

    assert "tipo_proteccion" in columns


def test_parametro_calculo_tiene_las_columnas_esperadas():
    inspector = inspect(engine)
    columns = {c["name"] for c in inspector.get_columns("parametro_calculo")}

    assert columns == {
        "id",
        "tension_mono_v",
        "tension_tri_v",
        "cos_phi",
        "ratio_selectividad",
        "factor_llenado_cablecanal",
        "actualizado_por",
        "actualizado_en",
    }
