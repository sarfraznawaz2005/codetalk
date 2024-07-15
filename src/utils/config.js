import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const configPath = path.resolve(__dirname, '../../codetalk.json');

let cachedConfig = null;

function loadConfig() {
    if (cachedConfig) return cachedConfig;

    try {
        if (!fs.existsSync(configPath)) {
            throw new Error('Config file not found');
        }
        const configData = fs.readFileSync(configPath, 'utf8');
        cachedConfig = JSON.parse(configData);

        if (cachedConfig.codebase_path) {
            cachedConfig.codebase_path = path.resolve(process.cwd(), cachedConfig.codebase_path);
        } else {
            cachedConfig.codebase_path = process.cwd();
        }

        return cachedConfig;
    } catch (error) {
        console.error('Error loading config:', error.message);
        process.exit(1);
    }
}

export { loadConfig };

