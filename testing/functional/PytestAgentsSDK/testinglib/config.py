from os import environ
from typing import Optional

from microsoft_agents.copilotstudio.client import (
    ConnectionSettings,
    PowerPlatformCloud,
    AgentType,
)


class McsConnectionSettings(ConnectionSettings):
    def __init__(
        self,
        app_client_id: Optional[str] = None,
        tenant_id: Optional[str] = None,
        environment_id: Optional[str] = None,
        agent_identifier: Optional[str] = None,
        cloud: Optional[PowerPlatformCloud] = None,
        copilot_agent_type: Optional[AgentType] = None,
        custom_power_platform_cloud: Optional[str] = None,
    ) -> None:
        self.app_client_id = app_client_id or environ.get("APP_CLIENT_ID")
        self.tenant_id = tenant_id or environ.get("TENANT_ID")

        if not self.app_client_id:
            raise ValueError("App Client ID must be provided")
        if not self.tenant_id:
            raise ValueError("Tenant ID must be provided")

        environment_id = environment_id or environ.get("ENVIRONMENT_ID")
        agent_identifier = agent_identifier or environ.get("AGENT_IDENTIFIER")
        cloud = cloud or PowerPlatformCloud[environ.get("CLOUD", "UNKNOWN")]
        copilot_agent_type = (
            copilot_agent_type
            or AgentType[environ.get("COPILOT_agent_type", "PUBLISHED")]
        )
        custom_power_platform_cloud = custom_power_platform_cloud or environ.get(
            "CUSTOM_POWER_PLATFORM_CLOUD", None
        )

        super().__init__(
            environment_id,
            agent_identifier,
            cloud,
            copilot_agent_type,
            custom_power_platform_cloud,
        )