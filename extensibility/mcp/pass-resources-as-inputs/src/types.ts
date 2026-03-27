// Type definitions shared across the simpler MCP server

export interface GeneratedResource {
  uri: string;
  name: string;
  description: string;
  mimeType: string;
  createdAt: string;
  length: number;
  resourceType: 'text';
  text: string;
}
