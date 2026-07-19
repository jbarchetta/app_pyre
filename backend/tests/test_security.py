import jwt
import pytest

from app.auth.security import create_access_token, decode_access_token, hash_password, verify_password


def test_hash_password_does_not_return_plaintext():
    hashed = hash_password("clave-segura-123")

    assert hashed != "clave-segura-123"


def test_verify_password_accepts_correct_password():
    hashed = hash_password("clave-segura-123")

    assert verify_password("clave-segura-123", hashed) is True


def test_verify_password_rejects_wrong_password():
    hashed = hash_password("clave-segura-123")

    assert verify_password("otra-clave", hashed) is False


def test_verify_password_acepta_hash_legacy_de_passlib():
    # Hash literal generado con passlib 1.7.4 (bcrypt estándar $2b$12$) para la
    # clave "test-clave-123". Tras reemplazar passlib por bcrypt directo (ciclo
    # 8), los usuarios creados antes del cambio deben seguir pudiendo loguearse
    # sin migración de hashes.
    hash_legacy = "$2b$12$Mejz.f440tJJ3yq.IatbiO.cMrwQSZYdQNCbfUv8qkgQGoGKHiduW"

    assert verify_password("test-clave-123", hash_legacy) is True
    assert verify_password("otra-clave", hash_legacy) is False


def test_access_token_round_trip():
    token = create_access_token(subject="user-id-123", rol="analista")
    payload = decode_access_token(token)

    assert payload["sub"] == "user-id-123"
    assert payload["rol"] == "analista"


def test_access_token_rejects_bad_signature():
    token = create_access_token(subject="user-id-123", rol="analista")
    header, payload, signature = token.split(".")
    # Flip the signature's first character rather than the token's last: the
    # last base64url character can encode unused padding bits, so tampering
    # it is flaky (sometimes decodes to the same bytes). The first character
    # of a 32-byte HS256 signature is always fully significant.
    tampered_signature = ("A" if signature[0] != "A" else "B") + signature[1:]
    tampered = f"{header}.{payload}.{tampered_signature}"

    with pytest.raises(jwt.PyJWTError):
        decode_access_token(tampered)
