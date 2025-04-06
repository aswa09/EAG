// Add this at the very top of the file
console.log('Email Response Generator Extension: Content script loaded');

// Function to transform text using FastAPI backend
async function transformText(text, persona) {
    console.log('transformText - Start', { text, persona });
    try {
        const response = await fetch('http://localhost:8000/transform', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                text: text,
                persona: persona
            })
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();
        console.log('transformText - Complete:', result);
        return result.transformed_text;
    } catch (error) {
        console.error('transformText - Error:', error);
        throw error;
    }
}

// Function to get the email editor element based on the email service
function getEmailEditor() {
  // Gmail
  if (window.location.hostname === 'mail.google.com') {
    return document.querySelector('div[role="textbox"][aria-label*="Message Body"]');
  }
  // Outlook
  else if (window.location.hostname.includes('outlook')) {
    return document.querySelector('[role="textbox"]');
  }
  return null;
}

// Utility function for consistent logging
function logStep(functionName, data = null) {
    const logStyle = 'color: #2196F3; font-weight: bold;';
    console.group(`%c[Email Response Generator] ${functionName}`, logStyle);
    if (data) {
        console.log('Data:', data);
    }
    console.groupEnd();
}

// Function to get email content from Gmail
function getEmailContent() {
    console.log('getEmailContent - Start');
    try {
        // Get the current email content from the thread view
        const emailContent = document.querySelector('.a3s.aiL')?.innerText || '';
        const subject = document.querySelector('.hP')?.textContent || 'No Subject';
        const sender = document.querySelector('.gD')?.textContent || 'Unknown Sender';
        const date = document.querySelector('.xW')?.textContent || new Date().toISOString();

        if (!emailContent) {
            console.error('getEmailContent - Error: No email content found');
            throw new Error('Please open an email to generate a response');
        }

        console.log('getEmailContent - Complete:', { subject, sender, content: emailContent });
        return { subject, sender, content: emailContent, date };
    } catch (error) {
        console.error('getEmailContent - Error:', error);
        throw error;
    }
}

// Function to insert response into Gmail
function insertResponse(response) {
    console.log('insertResponse - Start', { response });
    try {
        // Try to find the compose box in different possible locations
        let composeBox = null;
        
        // First try the full compose window
        const composeWindow = document.querySelector('div[role="dialog"]');
        if (composeWindow) {
            composeBox = composeWindow.querySelector('div[role="textbox"][aria-label*="Message Body"]');
        }
        
        // If not found, try the inline reply box
        if (!composeBox) {
            composeBox = document.querySelector('div[role="textbox"][aria-label*="Message Body"]');
        }
        
        // If still not found, try the reply box in the thread view
        if (!composeBox) {
            composeBox = document.querySelector('div[role="textbox"][aria-label*="Reply"]');
        }

        if (!composeBox) {
            console.error('insertResponse - Error: Compose box not found');
            throw new Error('Please make sure you have clicked Reply or Compose');
        }

        composeBox.innerHTML = response;
        console.log('insertResponse - Complete');
    } catch (error) {
        console.error('insertResponse - Error:', error);
        throw error;
    }
}

// Function to get current settings
async function getSettings() {
    console.log('getSettings - Start');
    try {
        const result = await chrome.storage.local.get('settings');
        console.log('getSettings - Complete:', result);
        return result.settings || {
            tone: 'professional',
            maxLength: 500,
            includeGreeting: true,
            includeSignature: true
        };
    } catch (error) {
        console.error('getSettings - Error:', error);
        throw error;
    }
}

// Function to analyze email content
async function analyzeEmail(emailData, settings) {
    console.log('analyzeEmail - Start', { emailData });
    try {
        console.log('Sending request to FastAPI server...');
        const response = await fetch('http://localhost:8000/analyze', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                email: emailData,
                settings: settings
            })
        });

        console.log('FastAPI Response Status:', response.status);
        console.log('FastAPI Response Headers:', Object.fromEntries(response.headers.entries()));

        if (!response.ok) {
            const error = await response.text();
            console.error('analyzeEmail - Error:', error);
            throw new Error('Failed to analyze email: ' + error);
        }

        const result = await response.json();
        console.log('analyzeEmail - Complete:', result);
        return result;
    } catch (error) {
        console.error('analyzeEmail - Error:', error);
        throw error;
    }
}

// Function to generate email response
async function generateResponse(analysis, settings) {
    console.log('generateResponse - Start', { analysis });
    try {
        console.log('Sending request to FastAPI server...');
        const response = await fetch('http://localhost:8000/generate-response', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                analysis: analysis,
                settings: settings
            })
        });

        console.log('FastAPI Response Status:', response.status);
        console.log('FastAPI Response Headers:', Object.fromEntries(response.headers.entries()));

        if (!response.ok) {
            const error = await response.text();
            console.error('generateResponse - Error:', error);
            throw new Error('Failed to generate response: ' + error);
        }

        const result = await response.json();
        console.log('generateResponse - Complete:', result);
        return result.response;
    } catch (error) {
        console.error('generateResponse - Error:', error);
        throw error;
    }
}

// Function to format email response in markdown
function formatEmailResponse(response) {
    console.log('formatEmailResponse - Start:', response);
    try {
        // Split the response into lines
        const lines = response.split('\n');
        let formattedResponse = '';
        
        // Process each line
        for (let line of lines) {
            line = line.trim();
            if (!line) continue; // Skip empty lines
            
            // Check if line is a greeting
            if (line.match(/^(Dear|Hi|Hello|Greetings)/i)) {
                formattedResponse += line + '\n\n';
                continue;
            }
            
            // Check if line is a closing
            if (line.match(/^(Best regards|Sincerely|Regards|Thanks|Thank you)/i)) {
                formattedResponse += '\n' + line + '\n';
                continue;
            }
            
            // Regular paragraph
            formattedResponse += line + '\n';
        }
        
        // Clean up extra newlines
        formattedResponse = formattedResponse
            .replace(/\n{3,}/g, '\n\n')  // Replace 3+ newlines with 2
            .trim();
            
        console.log('formatEmailResponse - Complete:', formattedResponse);
        return formattedResponse;
    } catch (error) {
        console.error('formatEmailResponse - Error:', error);
        return response; // Return original response if formatting fails
    }
}

// Main function to generate email response
async function generateEmailResponse() {
    console.log('generateEmailResponse - Start');
    try {
        // Get current settings
        const settings = await getSettings();
        console.log('Current settings:', settings);

        // Get email content
        const emailData = getEmailContent();
        console.log('Email data:', emailData);

        // Analyze email
        const analysis = await analyzeEmail(emailData, settings);
        console.log('Email analysis:', analysis);

        // Generate response
        const response = await generateResponse(analysis, settings);
        console.log('Generated response:', response);

        // Format the response
        const formattedResponse = formatEmailResponse(response);
        console.log('Formatted response:', formattedResponse);

        return { success: true, response: formattedResponse };
    } catch (error) {
        console.error('generateEmailResponse - Error:', error);
        return { success: false, error: error.message };
    }
}

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('Content script received message:', request);
    if (request.action === 'generateResponse') {
        console.log('Starting response generation process');
        generateEmailResponse()
            .then(response => {
                console.log('Response generated successfully:', response);
                sendResponse(response);
            })
            .catch(error => {
                console.error('Error in generateEmailResponse:', error);
                sendResponse({ success: false, error: error.message });
            });
        return true; // Will respond asynchronously
    } else {
        console.log('Received unknown message action:', request.action);
    }
}); 