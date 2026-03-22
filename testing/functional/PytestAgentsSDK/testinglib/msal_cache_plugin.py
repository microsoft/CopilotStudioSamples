import logging

from msal_extensions import (
    build_encrypted_persistence,
    FilePersistence,
    PersistedTokenCache,
)


def get_msal_token_cache(
    cache_path: str, fallback_to_plaintext=True
) -> PersistedTokenCache:

    persistence = None

    # Note: This sample stores both encrypted persistence and plaintext persistence
    # into same location, therefore their data would likely override with each other.
    try:
        persistence = build_encrypted_persistence(cache_path)
    except:  # pylint: disable=bare-except
        # On Linux, encryption exception will be raised during initialization.
        # On Windows and macOS, they won't be detected here,
        # but will be raised during their load() or save().
        if not fallback_to_plaintext:
            raise
        logging.warning("Encryption unavailable. Opting in to plain text.")
        persistence = FilePersistence(cache_path)

    return PersistedTokenCache(persistence)