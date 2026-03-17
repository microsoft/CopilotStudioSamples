import asyncio
from os import environ, path

from dotenv import load_dotenv
load_dotenv()

from msal import PublicClientApplication
from microsoft_agents.copilotstudio.client import CopilotClient
#from microsoft_agents.activity import ActivityTypes

from testinglib.config import McsConnectionSettings
from testinglib.msal_cache_plugin import get_msal_token_cache


class CopilotStudioClient:
    def __init__(self):
        self.connection_settings = McsConnectionSettings()
        self.token = self._acquire_token()
        self.client = CopilotClient(self.connection_settings, self.token)

    def _acquire_token(self) -> str:
        cache_path = environ.get("TOKEN_CACHE_PATH") or path.join(path.dirname(__file__), "../../bin/token_cache.bin")
        cache = get_msal_token_cache(cache_path)

        app = PublicClientApplication(
            self.connection_settings.app_client_id,
            authority=f"https://login.microsoftonline.com/{self.connection_settings.tenant_id}",
            token_cache=cache,
        )

        token_scopes = ["https://api.powerplatform.com/.default"]
        accounts = app.get_accounts()

        if accounts:
            result = app.acquire_token_silent(scopes=token_scopes, account=accounts[0])
        else:
            result = app.acquire_token_interactive(scopes=token_scopes)

        if "access_token" in result:
            return result["access_token"]
        else:
            raise Exception(f"Token acquisition failed: {result.get('error_description')}")
