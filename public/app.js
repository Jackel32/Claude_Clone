document.addEventListener('DOMContentLoaded', () => {
    // --- CHAT LOGIC ---
    const chatWindow = document.getElementById('chat-window');
    const chatForm = document.getElementById('chat-form');
    const messageInput = document.getElementById('message-input');
    const socket = new WebSocket(`ws://${window.location.host}`);
    let assistantMessageElement = null;

    socket.onopen = () => console.log('WebSocket connection established.');
    
    socket.onmessage = (event) => {
        const message = JSON.parse(event.data);
        const chatContent = chatWindow.parentElement; // Get the scrollable container

        if (message.type === 'start') {
            assistantMessageElement = createMessageElement('assistant');
            chatWindow.insertBefore(assistantMessageElement, chatWindow.firstChild);
        } else if (message.type === 'chunk') {
            if (assistantMessageElement) {
                assistantMessageElement.firstChild.textContent += message.content;
            }
        } else if (message.type === 'end') {
            assistantMessageElement = null;
        } else if (message.type === 'error') {
            const errorElement = createMessageElement('assistant', 'error');
            errorElement.firstChild.textContent = `Error: ${message.content}`;
            chatWindow.insertBefore(errorElement, chatWindow.firstChild);
        }
    };

    chatForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const messageText = messageInput.value;
        if (messageText.trim() === '') return;

        const userMessage = createMessageElement('user');
        userMessage.firstChild.textContent = messageText;
        chatWindow.insertBefore(userMessage, chatWindow.firstChild);

        socket.send(JSON.stringify({ content: messageText }));
        messageInput.value = '';
    });

    function createMessageElement(role, type = 'normal') {
        const messageDiv = document.createElement('div');
        messageDiv.classList.add('message', role);
        if (type === 'error') messageDiv.style.color = '#ff8a8a';
        
        const p = document.createElement('p');
        messageDiv.appendChild(p);
        
        return messageDiv;
    }

    // --- ACTION BUTTONS AND MODAL LOGIC ---
    const addDocsBtn = document.getElementById('add-docs-btn');
    const modalOverlay = document.getElementById('modal-overlay');
    const modalTitle = document.getElementById('modal-title');
    const modalContent = document.getElementById('modal-content');
    const modalActions = document.getElementById('modal-actions');

    if (addDocsBtn) {
        addDocsBtn.addEventListener('click', showAddDocsDialog);
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
    
    modalOverlay.addEventListener('click', (e) => {
        if (e.target === modalOverlay) hideModal();
    });

    async function showAddDocsDialog() {
        showModal('Add Documentation: Select a File');
        modalContent.textContent = 'Loading files...';

        try {
            const response = await fetch('/api/files');
            if (!response.ok) throw new Error(`Server error: ${response.statusText}`);
            const files = await response.json();
            
            const fileList = document.createElement('ul');
            files.forEach(file => {
                const li = document.createElement('li');
                li.textContent = file;
                li.onclick = () => onFileSelectForDocs(file);
                fileList.appendChild(li);
            });
            modalContent.innerHTML = '';
            modalContent.appendChild(fileList);
        } catch (error) {
            modalContent.textContent = `Error loading files: ${error.message}`;
        }
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

    const gitDiffBtn = document.getElementById('git-diff-btn');
    if (gitDiffBtn) {
        gitDiffBtn.addEventListener('click', showGitDiffDialog);
    }

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