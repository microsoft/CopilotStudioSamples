const fs = require("fs");
const path = require("path");

console.log("Ensuring env files exist...");

const envPath = path.join(__dirname, "..", "env");
const envs = [
  {
    name: ".env.local",
    requiredVars: ["TEAMSFX_ENV", "TUNNEL_ID", "BOT_ENDPOINT", "BOT_DOMAIN", "SSO_APP_ID", "MCS_CONNECTION_NAME", "MCS_ENVIRONMENT_ID", "MCS_SCHEMA_NAME", "AZURE_OPENAI_ENDPOINT", "AZURE_OPENAI_DEPLOYMENT"],
    content: `TEAMSFX_ENV=local\nTUNNEL_ID=\nBOT_ENDPOINT=\nBOT_DOMAIN=\nSSO_APP_ID=00000000-0000-0000-0000-000000000000\nMCS_CONNECTION_NAME=mcs\nMCS_ENVIRONMENT_ID=\nMCS_SCHEMA_NAME=\nAZURE_OPENAI_ENDPOINT=\nAZURE_OPENAI_DEPLOYMENT=gpt-4o`,
  }
];

envs.forEach((env) => {
  const envFilePath = path.join(envPath, env.name);
  
  if (!fs.existsSync(envFilePath)) {
    // Create new file
    fs.mkdirSync(envPath, { recursive: true });
    fs.writeFileSync(envFilePath, env.content);
    console.log(`Created ${env.name}`);
  } else {
    // Check and add missing variables to existing file
    let content = fs.readFileSync(envFilePath, "utf8");
    let modified = false;
    
    env.requiredVars.forEach((varName) => {
      const regex = new RegExp(`^${varName}=(.*)$`, "m");
      const match = content.match(regex);
      
      if (!match) {
        // Variable doesn't exist, add it with default value
        const defaultValue = varName === "SSO_APP_ID" ? "00000000-0000-0000-0000-000000000000" : "";
        content += `\n${varName}=${defaultValue}`;
        modified = true;
        console.log(`Added ${varName} to ${env.name}`);
      } else if (varName === "SSO_APP_ID" && match[1].trim() === "") {
        // SSO_APP_ID exists but is empty, set default GUID
        content = content.replace(regex, `${varName}=00000000-0000-0000-0000-000000000000`);
        modified = true;
        console.log(`Set default GUID for ${varName} in ${env.name}`);
      }
    });
    
    if (modified) {
      fs.writeFileSync(envFilePath, content);
    }
  }
});

console.log("Done!");