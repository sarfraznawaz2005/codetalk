import { clearVectorStore } from '../utils/vectorStore.js';

async function clear() {
    try {
        await clearVectorStore();
        console.log('Vector store cleared successfully.');
    } catch (error) {
        console.error('Error clearing vector store:', error.message);
    }
}


export { clear };
