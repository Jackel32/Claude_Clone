document.addEventListener('DOMContentLoaded', () => {
    // --- ELEMENT SELECTORS ---
    const chatWindow = document.getElementById('chat-window');
    const chatForm = document.getElementById('chat-form');
    const messageInput = document.getElementById('message-input');
    const modalOverlay = document.getElementById('modal-overlay');
    const modalTitle = document.getElementById('modal-title');
    const modalContent = document.getElementById('modal-content');
    const modalActions = document.getElementById('modal-actions');
    const agentTaskBtn = document.getElementById('agent-task-btn');
    const addDocsBtn = document.getElementById('add-docs-btn');
    const refactorBtn = document.getElementById('refactor-btn');
    const testBtn = document.getElementById('test-btn');
    const gitDiffBtn = document.getElementById('git-diff-btn');

    // --- WEBSOCKET SETUP ---
    const socket = new WebSocket(`ws://${window.location.host}`);
    let assistantMessageElement = null;

    socket.onopen = () => console.log('WebSocket connection established.');

    socket.onmessage = (event) => {
        const message = JSON.parse(event.data);
        displayMessage(message);
    };

    // --- EVENT LISTENERS ---
    chatForm.addEventListener('submit', handleChatSubmit);
    if(agentTaskBtn) agentTaskBtn.addEventListener('click', showAgentDialog);
    if(addDocsBtn) addDocsBtn.addEventListener('click', showAddDocsDialog);
    if(refactorBtn) refactorBtn.addEventListener('click', showRefactorDialog);
    if(testBtn) testBtn.addEventListener('click', showTestDialog);
    if(gitDiffBtn) gitDiffBtn.addEventListener('click', showGitDiffDialog);
    modalOverlay.addEventListener('click', (e) => {
        if (e.target === modalOverlay) hideModal();
    });

    // --- CORE UI FUNCTIONS ---
    function createMessageElement(role, type = 'normal') {
        const messageDiv = document.createElement('div');
        messageDiv.classList.add('message', role);
        if (type === 'error') messageDiv.style.color = '#ff8a8a';
        const p = document.createElement('p');
        messageDiv.appendChild(p);
        return messageDiv;
    }

    function displayMessage(message) {
        let el;
        switch (message.type) {
            case 'thought':
                el = createMessageElement('assistant');
                el.firstChild.textContent = `Thought: ${message.content}`;
                break;
            case 'action':
                el = createMessageElement('assistant');
                el.firstChild.textContent = `Action: ${message.content}`;
                break;
            case 'observation':
                el = createMessageElement('assistant');
                el.firstChild.innerHTML = `<strong>Observation:</strong><pre>${message.content}</pre>`;
                break;
            case 'finish':
                el = createMessageElement('assistant');
                el.style.backgroundColor = '#1e8e3e';
                el.firstChild.textContent = `✅ Task Complete: ${message.content}`;
                break;
            case 'start':
                assistantMessageElement = createMessageElement('assistant');
                chatWindow.prepend(assistantMessageElement);
                return; // Don't prepend twice
            case 'chunk':
                if (assistantMessageElement) assistantMessageElement.firstChild.textContent += message.content;
                return; // Don't prepend, just append text
            case 'end':
                assistantMessageElement = null;
                return; // Don't prepend
            case 'error':
                el = createMessageElement('assistant', 'error');
                el.firstChild.textContent = `Error: ${message.content}`;
                break;
            default:
                return;
        }
        if (el) chatWindow.prepend(el);
    }
    
    function handleChatSubmit(e) {
        e.preventDefault();
        const messageText = messageInput.value;
        if (messageText.trim() === '') return;
        const userMessage = createMessageElement('user');
        userMessage.firstChild.textContent = messageText;
        chatWindow.prepend(userMessage);
        socket.send(JSON.stringify({ type: 'chat', content: messageText }));
        messageInput.value = '';
    }

    function showModal(title) {
        modalTitle.textContent = title;
        modalContent.innerHTML = '';
        modalActions.innerHTML = '';
        modalOverlay.classList.remove('hidden');
    }

    function hideModal() {
        modalOverlay.classList.add('hidden');
    }

    async function applyChanges(filePath, newContent) {
        try {
            const response = await fetch('/api/apply-changes', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ filePath, newContent }),
            });
            if (!response.ok) throw new Error(`Server error: ${response.statusText}`);
            hideModal();
            alert(`Changes applied successfully to ${filePath}`);
        } catch (error) {
            modalContent.textContent = `Error applying changes: ${error.message}`;
        }
    }

    // --- ACTION WORKFLOWS ---

    function showAgentDialog() {
        const task = prompt("What task would you like the AI agent to perform?");
        if (task && task.trim()) {
            chatWindow.innerHTML = '';
            socket.send(JSON.stringify({ type: 'agent-task', task }));
            const userMessage = createMessageElement('user');
            userMessage.firstChild.textContent = `Task: ${task}`;
            chatWindow.prepend(userMessage);
        }
    }

    async function showGenericFileDialog(title, onFileSelect) {
        showModal(title);
        modalContent.textContent = 'Loading files...';
        try {
            const response = await fetch('/api/files');
            if (!response.ok) throw new Error(`Server error: ${response.statusText}`);
            const files = await response.json();
            const fileList = document.createElement('ul');
            files.forEach(file => {
                const li = document.createElement('li');
                li.textContent = file;
                li.onclick = () => onFileSelect(file);
                fileList.appendChild(li);
            });
            modalContent.innerHTML = '';
            modalContent.appendChild(fileList);
        } catch (error) {
            modalContent.textContent = `Error loading files: ${error.message}`;
        }
    }

    // --- Add Docs ---
    function showAddDocsDialog() {
        showGenericFileDialog('Add Documentation: Select a File', onFileSelectForDocs);
    }
    async function onFileSelectForDocs(filePath) {
        modalTitle.textContent = 'Generating Documentation...';
        modalContent.textContent = 'Please wait, the AI is working...';
        try {
            const response = await fetch('/api/add-docs', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ filePath }),
            });
            if (!response.ok) throw new Error(`Server error: ${response.statusText}`);
            const { patch, newContent } = await response.json();
            modalTitle.textContent = `Proposed Changes for ${filePath}`;
            modalContent.innerHTML = `<pre>${patch}</pre>`;
            
            const applyBtn = document.createElement('button');
            applyBtn.textContent = 'Apply Changes';
            applyBtn.onclick = () => applyChanges(filePath, newContent);
            
            const cancelBtn = document.createElement('button');
            cancelBtn.textContent = 'Cancel';
            cancelBtn.onclick = hideModal;

            modalActions.innerHTML = '';
            modalActions.appendChild(cancelBtn);
            modalActions.appendChild(applyBtn);
        } catch (error) {
            modalContent.textContent = `Error generating docs: ${error.message}`;
        }
    }

    // --- Refactor File ---
    function showRefactorDialog() {
        showGenericFileDialog('Refactor File: Select a File', onFileSelectForRefactor);
    }
    async function onFileSelectForRefactor(filePath) {
        const promptText = prompt(`Enter your refactoring instructions for ${filePath}:`);
        if (!promptText || !promptText.trim()) return;

        modalTitle.textContent = 'Refactoring File...';
        modalContent.textContent = 'Please wait, the AI is working...';
        try {
            const response = await fetch('/api/refactor', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ filePath, prompt: promptText }),
            });
            if (!response.ok) throw new Error(`Server error: ${response.statusText}`);
            const { patch, newContent } = await response.json();
            modalTitle.textContent = `Proposed Refactor for ${filePath}`;
            modalContent.innerHTML = `<pre>${patch}</pre>`;
            
            const applyBtn = document.createElement('button');
            applyBtn.textContent = 'Apply Changes';
            applyBtn.onclick = () => applyChanges(filePath, newContent);
            const cancelBtn = document.createElement('button');
            cancelBtn.textContent = 'Cancel';
            cancelBtn.onclick = hideModal;
            modalActions.innerHTML = '';
            modalActions.appendChild(cancelBtn);
            modalActions.appendChild(applyBtn);
        } catch (error) {
            modalContent.textContent = `Error refactoring file: ${error.message}`;
        }
    }

    // --- Generate Test ---
    function showTestDialog() {
        showGenericFileDialog('Generate Test: Select a File', onFileSelectForTest);
    }
    async function onFileSelectForTest(filePath) {
        const symbol = prompt(`Enter the function/class name to test in ${filePath}:`);
        if (!symbol || !symbol.trim()) return;

        modalTitle.textContent = 'Generating Test...';
        modalContent.textContent = 'Please wait, the AI is working...';
        try {
            const response = await fetch('/api/test', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ filePath, symbol, framework: 'jest' }),
            });
            if (!response.ok) throw new Error(`Server error: ${response.statusText}`);
            const { newContent } = await response.json();
            const defaultPath = filePath.replace('.ts', '.test.ts');
            const outputPath = prompt(`Generated test for "${symbol}".\nEnter path to save file:`, defaultPath);
            if (!outputPath) return;
            
            await applyChanges(outputPath, newContent); // applyChanges also works for new files
        } catch (error) {
            modalContent.textContent = `Error generating test: ${error.message}`;
        }
    }

    // --- Git Diff ---
    async function showGitDiffDialog() {
        showModal('Analyze Commits: Select Start Commit (Older)');
        modalContent.textContent = 'Loading commit history...';
        try {
            const response = await fetch('/api/commits');
            if (!response.ok) throw new Error(`Server error: ${response.statusText}`);
            const commits = await response.json();
            
            const commitList = document.createElement('ul');
            commits.forEach(commitLine => {
                const [hash, author, date, msg] = commitLine.split('|');
                const li = document.createElement('li');
                li.textContent = `${hash} - ${msg.trim()} (${author}, ${date})`;
                li.onclick = () => onCommitSelect_Start(hash, commits);
                commitList.appendChild(li);
            });
            modalContent.innerHTML = '';
            modalContent.appendChild(commitList);
        } catch (error) {
            modalContent.textContent = `Error loading commits: ${error.message}`;
        }
    }
    function onCommitSelect_Start(startCommit, commits) {
        modalTitle.textContent = 'Analyze Commits: Select End Commit (Newer)';
        const commitList = document.createElement('ul');
        commits.forEach(commitLine => {
            const [hash, author, date, msg] = commitLine.split('|');
            const li = document.createElement('li');
            li.textContent = `${hash} - ${msg.trim()} (${author}, ${date})`;
            li.onclick = () => onCommitSelect_End(startCommit, hash);
            commitList.appendChild(li);
        });
        modalContent.innerHTML = '';
        modalContent.appendChild(commitList);
    }
    async function onCommitSelect_End(startCommit, endCommit) {
        modalTitle.textContent = 'Generating Diff...';
        modalContent.textContent = 'Please wait, generating the diff between commits...';
        try {
            const response = await fetch('/api/diff', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ startCommit, endCommit }),
            });
            if (!response.ok) throw new Error(`Server error: ${response.statusText}`);
            const { patch } = await response.json();
            modalTitle.textContent = `Changes between ${startCommit.substring(0,7)} and ${endCommit.substring(0,7)}`;
            modalContent.innerHTML = `<pre>${patch}</pre>`;
            
            const closeBtn = document.createElement('button');
            closeBtn.textContent = 'Close';
            closeBtn.onclick = hideModal;
            modalActions.innerHTML = '';
            modalActions.appendChild(closeBtn);
        } catch (error) {
            modalContent.textContent = `Error generating diff: ${error.message}`;
        }
    }
});