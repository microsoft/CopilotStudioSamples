import os.path
import json

from msal import TokenCache


class LocalTokenCache(TokenCache):

    def __init__(self, cache_location: str):
        super().__init__()
        self.__cache_location = cache_location
        self.__has_state_changed = False

        if not os.path.exists(self.__cache_location):
            with self._lock:
                if not os.path.exists(self.__cache_location):
                    with open(self.__cache_location, "w") as f:
                        json.dump({}, f)
        else:
            with self._lock:
                with open(self.__cache_location, "r") as f:
                    self._cache = json.load(f)

    def add(self, event, **kwargs):
        super().add(event, **kwargs)
        self.__has_state_changed = True  # cache correctness shouldn't be impacted if another thread modified __has_state_changed between this and the previous line

    def modify(self, credential_type, old_entry, new_key_value_pairs=None):
        super().modify(credential_type, old_entry, new_key_value_pairs)
        self.__has_state_changed = True

    def serialize(self):
        if self.__has_state_changed:
            with self._lock:
                if self.__has_state_changed:
                    with open(self.__cache_location, "w") as f:
                        json.dump(self._cache, f)
                        self.__has_state_changed = False
                        return json.dumps(self._cache)
