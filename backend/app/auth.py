import bcrypt
from datetime import datetime, timedelta

from fastapi import HTTPException, status
from jose import JWTError, jwt

from app.core.config import settings


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return bcrypt.checkpw(plain_password.encode('utf-8'), hashed_password.encode('utf-8'))


def create_access_token(data: dict) -> str:
    to_encode = data.copy()
    # jose requires 'sub' to be a string per JWT RFC
    if 'sub' in to_encode:
        to_encode['sub'] = str(to_encode['sub'])
    expire = datetime.now() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({'exp': expire, 'purpose': 'access'})
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def create_refresh_token(data: dict) -> str:
    to_encode = data.copy()
    # jose requires 'sub' to be a string per JWT RFC
    if 'sub' in to_encode:
        to_encode['sub'] = str(to_encode['sub'])
    expire = datetime.now() + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    to_encode.update({'exp': expire, 'purpose': 'refresh'})
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def verify_token(token: str, expected_purpose: str) -> dict:
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail='Could not validate token',
            headers={'WWW-Authenticate': 'Bearer'},
        )

    purpose = payload.get('purpose')
    if purpose != expected_purpose:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail='Invalid token purpose',
            headers={'WWW-Authenticate': 'Bearer'},
        )

    # Convert string sub back to int for compatibility with TokenPayload.sub: int
    if 'sub' in payload and isinstance(payload['sub'], str):
        payload['sub'] = int(payload['sub'])

    return payload
