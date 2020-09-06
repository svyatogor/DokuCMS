import fs from 'fs'
import dotenv from 'dotenv'
import dotenvExpand from 'dotenv-expand'

const NODE_ENV = process.env.NODE_ENV || 'development'

var dotenvFiles = [
  `.env.local`,
  `.env.${NODE_ENV}`,
  NODE_ENV !== 'test' && '.env.local',
  '.env',
].filter(Boolean);

dotenvFiles.forEach(dotenvFile => {
  if (fs.existsSync(dotenvFile)) {
    console.log(`Loading ${dotenvFile}`);
    dotenvExpand(dotenv.config({
      path: dotenvFile,
    }));
  }
});