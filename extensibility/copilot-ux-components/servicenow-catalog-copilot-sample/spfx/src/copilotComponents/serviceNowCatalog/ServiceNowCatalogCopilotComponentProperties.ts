/**
 * Tool parameters for the ServiceNow catalog component. The manifest
 * references the compiled `.js` default export (JSON Schema draft-7).
 */
import { z } from 'zod';

const propertiesSchema = z.object({
  query: z
    .string()
    .optional()
    .describe(
      "What the user is looking for in the ServiceNow service catalog, as a short natural-language sentence " +
        'that keeps the important details from the request, for example "software to edit and sign PDF files", ' +
        '"a laptop for a software developer" or "Adobe Creative Cloud". It is matched semantically. Omit it to browse the whole catalog.'
    ),
  itemSysId: z
    .string()
    .optional()
    .describe(
      'The 32-character ServiceNow sys_id of one catalog item whose request form should open directly. ' +
        'Set it only when the user picked a specific item and its exact SysId is known from the catalog ' +
        'knowledge results. Never guess or invent a sys_id.'
    )
});

export type IServiceNowCatalogCopilotComponentProperties = z.infer<typeof propertiesSchema>;

export default z.toJSONSchema(propertiesSchema, { target: 'draft-7' });
