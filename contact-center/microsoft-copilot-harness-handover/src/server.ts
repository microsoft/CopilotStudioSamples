import { createWebApp } from './web.js';

const mode = process.env.MODE ?? 'mock';
if (mode !== 'mock' && mode !== 'studio') throw new Error('MODE must be mock or studio');
const hosting = process.env.HOSTING_TARGET ?? 'local';
if (hosting !== 'local' && hosting !== 'azure') throw new Error('HOSTING_TARGET must be local or azure');
if (hosting === 'azure' && mode !== 'studio') throw new Error('Azure hosting requires MODE=studio');
const port = Number(process.env.PORT ?? 3978);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT is invalid');
const { app } = createWebApp({ mode, hosting });
app.listen(port, hosting === 'local' ? '127.0.0.1' : '0.0.0.0', () => {
  console.log(`Handover relay (${mode}) listening on port ${port}. Local customer: / ; support: /support.html`);
});
