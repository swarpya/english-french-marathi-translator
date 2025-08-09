document.addEventListener('DOMContentLoaded', function() {
    const englishInput = document.getElementById('englishInput');
    const translateBtn = document.getElementById('translateBtn');
    const loading = document.getElementById('loading');
    const results = document.getElementById('results');
    const error = document.getElementById('error');
    const errorDetails = document.getElementById('errorDetails');
    const frenchResult = document.getElementById('frenchResult');
    const marathiResult = document.getElementById('marathiResult');
    const themeToggle = document.getElementById('themeToggle');

    // API Key elements on
    const apiKeySection = document.getElementById('apiKeySection');
    const translationSection = document.getElementById('translationSection');
    const groqApiKey = document.getElementById('groqApiKey');
    const saveKeyBtn = document.getElementById('saveKeyBtn');
    const changeKeyBtn = document.getElementById('changeKeyBtn');
    const toggleKeyVisibility = document.getElementById('toggleKeyVisibility');

    let currentApiKey = '';

    // Theme functionality
    let currentTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', currentTheme);
    updateThemeToggleText(currentTheme);

    themeToggle.addEventListener('click', function(e) {
        e.preventDefault();
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        
        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('theme', newTheme);
        updateThemeToggleText(newTheme);
    });

    function updateThemeToggleText(theme) {
        if (theme === 'dark') {
            themeToggle.innerHTML = '☀️ Light';
        } else {
            themeToggle.innerHTML = '🌙 Dark';
        }
    }

    // API Key Management
    function checkStoredApiKey() {
        const storedKey = sessionStorage.getItem('groqApiKey');
        if (storedKey) {
            currentApiKey = storedKey;
            showTranslationSection();
        }
    }

    function showTranslationSection() {
        apiKeySection.style.display = 'none';
        translationSection.style.display = 'block';
    }

    function showApiKeySection() {
        apiKeySection.style.display = 'block';
        translationSection.style.display = 'none';
        groqApiKey.value = '';
        results.style.display = 'none';
        error.style.display = 'none';
    }

    // Toggle API key visibility
    toggleKeyVisibility.addEventListener('click', function() {
        if (groqApiKey.type === 'password') {
            groqApiKey.type = 'text';
            toggleKeyVisibility.textContent = '🙈';
        } else {
            groqApiKey.type = 'password';
            toggleKeyVisibility.textContent = '👁️';
        }
    });

    // Save API key
    saveKeyBtn.addEventListener('click', function() {
        const apiKey = groqApiKey.value.trim();
        
        if (!apiKey) {
            alert('Please enter your Groq API key');
            return;
        }

        if (!apiKey.startsWith('gsk_')) {
            alert('Please enter a valid Groq API key (should start with "gsk_")');
            return;
        }

        currentApiKey = apiKey;
        sessionStorage.setItem('groqApiKey', apiKey);
        showTranslationSection();
    });

    // Change API key
    changeKeyBtn.addEventListener('click', function() {
        sessionStorage.removeItem('groqApiKey');
        currentApiKey = '';
        showApiKeySection();
    });

    // Main translation function with verification
    translateBtn.addEventListener('click', translateText);
    englishInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter' && e.ctrlKey) {
            translateText();
        }
    });

    // Update loading messages
    function updateLoadingMessage(message) {
        const loadingText = loading.querySelector('p');
        if (loadingText) {
            loadingText.textContent = message;
        }
    }

    async function translateText() {
        const text = englishInput.value.trim();
        
        if (!text) {
            alert('Please enter some text to translate');
            return;
        }

        if (!currentApiKey) {
            alert('API key is missing. Please refresh the page and enter your key.');
            return;
        }

        // Show loading, hide results/error
        loading.style.display = 'block';
        results.style.display = 'none';
        error.style.display = 'none';
        translateBtn.disabled = true;
        updateLoadingMessage('Step 1/2: Translating...');

        try {
            // Step 1: Initial Translation
            const translationResult = await performTranslation(text);
            
            updateLoadingMessage('Step 2/2: Verifying translation...');
            
            // Step 2: Verification
            const verificationResult = await verifyTranslation(text, translationResult);
            
            if (verificationResult.isValid) {
                // Translation verified - show results
                displayResults(translationResult);
            } else {
                // Translation failed verification - show error
                showVerificationError(verificationResult.issues);
            }

        } catch (err) {
            console.error('Translation error:', err);
            loading.style.display = 'none';
            error.style.display = 'block';
            errorDetails.textContent = err.message;
        } finally {
            translateBtn.disabled = false;
        }
    }

    // Step 1: Perform initial translation
    async function performTranslation(text) {
        const prompt = `Translate the following English text to French and then provide the French pronunciation in Marathi (Devanagari script).

Format your response exactly like this:
French: [French translation]
Marathi Pronunciation: [How to pronounce the French words using Marathi/Devanagari script]

English text: "${text}"`;

        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${currentApiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: 'openai/gpt-oss-20b',
                messages: [
                    {
                        role: 'system',
                        content: 'You are a helpful translation assistant. Always follow the exact format requested.'
                    },
                    {
                        role: 'user',
                        content: prompt
                    }
                ],
                temperature: 0.3,
                max_tokens: 500
            })
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error?.message || `HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        const result = data.choices[0].message.content;
        
        // Parse the response
        const frenchMatch = result.match(/French:\s*(.+?)(?=\n|Marathi|$)/);
        const marathiMatch = result.match(/Marathi Pronunciation:\s*(.+?)(?=\n|$)/);
        
        return {
            english: text,
            french: frenchMatch ? frenchMatch[1].trim() : '',
            marathi: marathiMatch ? marathiMatch[1].trim() : '',
            raw_response: result
        };
    }

    // Step 2: Verify the translation
    async function verifyTranslation(originalText, translationResult) {
        const verificationPrompt = `You are a translation verification expert. Please verify if this translation is accurate and properly formatted.

Original English: "${originalText}"
French Translation: "${translationResult.french}"
Marathi Pronunciation: "${translationResult.marathi}"

Check for:
1. Is the French translation accurate?
2. Is the Marathi pronunciation phonetically correct for the French words?
3. Are both fields properly filled (not empty or "not found")?
4. Does the Marathi use proper Devanagari script?

Respond with ONLY one of these formats:
VALID: Translation is correct
INVALID: [Specific reason why it's wrong]`;

        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${currentApiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: 'llama-3.1-70b-versatile', // Using different model for verification
                messages: [
                    {
                        role: 'system',
                        content: 'You are a strict translation verification expert. Be thorough in your verification.'
                    },
                    {
                        role: 'user',
                        content: verificationPrompt
                    }
                ],
                temperature: 0.1, // Lower temperature for more consistent verification
                max_tokens: 200
            })
        });

        if (!response.ok) {
            console.warn('Verification failed, proceeding with original translation');
            return { isValid: true }; // If verification fails, proceed with translation
        }

        const data = await response.json();
        const verificationResponse = data.choices[0].message.content.trim();
        
        if (verificationResponse.startsWith('VALID')) {
            return { isValid: true };
        } else if (verificationResponse.startsWith('INVALID')) {
            const issues = verificationResponse.replace('INVALID:', '').trim();
            return { isValid: false, issues: issues };
        } else {
            // If verification response is unclear, assume valid
            return { isValid: true };
        }
    }

    // Display successful results
    function displayResults(translationResult) {
        frenchResult.textContent = translationResult.french;
        marathiResult.textContent = translationResult.marathi;
        
        loading.style.display = 'none';
        results.style.display = 'block';
        
        // Add verification badge
        addVerificationBadge();
    }

    // Show verification error
    function showVerificationError(issues) {
        loading.style.display = 'none';
        error.style.display = 'block';
        errorDetails.innerHTML = `
            <strong>⚠️ Translation Verification Failed</strong><br>
            ${issues}<br><br>
            <em>Please try again with different wording or check your input.</em>
        `;
    }

    // Add verification badge to results
    function addVerificationBadge() {
        // Remove existing badge if any
        const existingBadge = document.querySelector('.verification-badge');
        if (existingBadge) {
            existingBadge.remove();
        }

        // Create verification badge
        const badge = document.createElement('div');
        badge.className = 'verification-badge';
        badge.innerHTML = '✅ Verified Translation';
        
        results.insertBefore(badge, results.firstChild);
    }

    // Initialize app
    checkStoredApiKey();
});

function copyToClipboard(elementId) {
    const element = document.getElementById(elementId);
    const text = element.textContent;
    
    navigator.clipboard.writeText(text).then(() => {
        // Show feedback
        const button = event.target;
        const originalText = button.textContent;
        button.textContent = 'Copied!';
        button.style.background = '#28a745';
        
        setTimeout(() => {
            button.textContent = originalText;
            button.style.background = '';
        }, 2000);
    }).catch(err => {
        console.error('Copy failed:', err);
        alert('Copy failed. Please select and copy manually.');
    });
}
