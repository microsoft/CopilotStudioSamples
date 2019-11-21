const generateDirectLineToken = require('../../generateDirectLineToken');
const {BOT_ID, BOT_TENANT_ID } = process.env;


// This module exports token value to /api/directline/token and can be accessed with GET
// Generates a new Direct Line token
module.exports = async (_, res) => {
  res.json({ token: await generateDirectLineToken(BOT_ID, BOT_TENANT_ID) });
};
