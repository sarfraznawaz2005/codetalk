let conversationHistory = [];

export function getConversationHistory() {
    return conversationHistory;
}

export function addToConversationHistory(role, content) {
    conversationHistory.push({ role, content });
    // Limit the history size to 10 entries (5 pairs of questions and answers)
    if (conversationHistory.length > 20) {
        conversationHistory = conversationHistory.slice(-20);
    }
}


export function clearConversationHistory() {
    conversationHistory = [];
}
