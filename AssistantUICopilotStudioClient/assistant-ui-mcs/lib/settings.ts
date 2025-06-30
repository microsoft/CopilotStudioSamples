// lib/settings.ts
import type { ConnectionSettings } from '@microsoft/agents-copilotstudio-client'

// Debug information for environment variable loading
console.log('Settings.ts environment variables check:', {
  ENVIRONMENT_ID: process.env.NEXT_PUBLIC_ENVIRONMENT_ID,
  AGENT_SCHEMA: process.env.NEXT_PUBLIC_AGENT_SCHEMA,
  CLIENT_ID: process.env.NEXT_PUBLIC_CLIENT_ID,
  TENANT_ID: process.env.NEXT_PUBLIC_TENANT_ID,
});


// Read all values from environment variables
export const settings: ConnectionSettings = {
  environmentId: process.env.NEXT_PUBLIC_ENVIRONMENT_ID || '',
  agentIdentifier: process.env.NEXT_PUBLIC_AGENT_SCHEMA || '',
  appClientId: process.env.NEXT_PUBLIC_CLIENT_ID || '',
  tenantId: process.env.NEXT_PUBLIC_TENANT_ID || '',
  cloud: process.env.NEXT_PUBLIC_CLOUD_ENVIRONMENT || '' // Optional
}

// Keep hardcoded scope as requested
export const msalSettings = {
  scopes: ['https://api.powerplatform.com/.default']
}

// Add console warnings during development to catch missing env vars
if (process.env.NODE_ENV !== 'production') {
  if (!settings.appClientId) {
    console.warn('Warning: NEXT_PUBLIC_CLIENT_ID environment variable is not set');
  }
  if (!settings.tenantId) {
    console.warn('Warning: NEXT_PUBLIC_TENANT_ID environment variable is not set');
  }
}