import { createServer } from "./server.js";

const PORT = parseInt(process.env.PORT || "3000");
createServer(PORT);
