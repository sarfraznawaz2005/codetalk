import { clearVectorStore, createVectorStore } from '../utils/vectorStore.js';

async function scan() {
    console.log('Scanning codebase and creating vector store...');
    try {
        await clearVectorStore();
        await createVectorStore();
        console.log('Vector store created successfully.');
    } catch (error) {
        console.error('Error creating vector store:', error.message);
    }
}

export { scan };

