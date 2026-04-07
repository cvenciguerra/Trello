// storage.js - Gerenciamento de dados e persistência

let data = JSON.parse(localStorage.getItem('kanban_v5')) || {
    boardTitle: 'FocusBoard',
    isDarkMode: false,
    lists: [
        { id: 'todo', name: '📋 A Fazer' },
        { id: 'doing', name: '⏳ Em Andamento' },
        { id: 'done', name: '✅ Concluído' }
    ],
    tasks: []
};

let historyStack = [JSON.stringify(data)];
let historyIndex = 0;
let isUndoing = false;

export function migrateData() {
    data.tasks.forEach(task => {
        if (!task.category) task.category = 'Trabalho';
        if (!task.priority) task.priority = 'medium';
        if (!task.comments) task.comments = [];
        if (!task.checklists) task.checklists = [];
        if (!task.timeSpent) task.timeSpent = 0;
        if (!task.order) task.order = 0;
        if (!task.createdAt) task.createdAt = Date.now();
    });
    saveToStorage();
}

function saveToStorage() {
    localStorage.setItem('kanban_v5', JSON.stringify(data));
}

function saveHistory() {
    if (!isUndoing) {
        historyStack = historyStack.slice(0, historyIndex + 1);
        historyStack.push(JSON.stringify(data));
        historyIndex++;
        if (historyStack.length > 50) {
            historyStack.shift();
            historyIndex--;
        }
    }
    saveToStorage();
}

export function undo() {
    if (historyIndex > 0) {
        historyIndex--;
        isUndoing = true;
        data = JSON.parse(historyStack[historyIndex]);
        isUndoing = false;
        saveToStorage();
        return true;
    }
    return false;
}

export function redo() {
    if (historyIndex < historyStack.length - 1) {
        historyIndex++;
        isUndoing = true;
        data = JSON.parse(historyStack[historyIndex]);
        isUndoing = false;
        saveToStorage();
        return true;
    }
    return false;
}

export function getData() { return data; }

export function getLists() { return data.lists; }

export function getTasks() { return data.tasks; }

export function addList(list) {
    data.lists.push(list);
    saveHistory();
}

export function removeList(listId) {
    data.lists = data.lists.filter(l => l.id !== listId);
    data.tasks = data.tasks.filter(t => t.listId !== listId);
    saveHistory();
}

export function updateList(listId, updates) {
    const list = data.lists.find(l => l.id === listId);
    if (list) { Object.assign(list, updates); saveHistory(); }
}

export function addTask(task) {
    data.tasks.push(task);
    saveHistory();
}

export function updateTask(taskId, updates) {
    const task = data.tasks.find(t => t.id === taskId);
    if (task) { Object.assign(task, updates); saveHistory(); }
}

export function removeTask(taskId) {
    data.tasks = data.tasks.filter(t => t.id !== taskId);
    saveHistory();
}

export function updateBoardTitle(title) {
    data.boardTitle = title;
    saveHistory();
}

export function toggleDarkMode() {
    data.isDarkMode = !data.isDarkMode;
    saveHistory();
}

export function clearAllData() {
    data = {
        boardTitle: 'FocusBoard',
        isDarkMode: false,
        lists: [
            { id: 'todo', name: '📋 A Fazer' },
            { id: 'doing', name: '⏳ Em Andamento' },
            { id: 'done', name: '✅ Concluído' }
        ],
        tasks: []
    };
    historyStack = [JSON.stringify(data)];
    historyIndex = 0;
    saveToStorage();
}

export function importData(importedData) {
    data = importedData;
    historyStack = [JSON.stringify(data)];
    historyIndex = 0;
    saveToStorage();
}
