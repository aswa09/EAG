// Handle installation
chrome.runtime.onInstalled.addListener(() => {
  console.log('Extension installed/updated');
  // Initialize any necessary storage or settings
  chrome.storage.local.set({
    settings: {
      tone: 'professional',
      maxLength: 500,
      includeGreeting: true,
      includeSignature: true
    }
  }, () => {
    console.log('Default settings initialized');
  });
});

// Listen for messages from content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Background script received message:', request);
  
  if (request.type === 'analyzeEmail') {
    console.log('Processing email analysis request');
    analyzeEmailWithLLM(request.emailContent)
      .then(response => {
        console.log('Email analysis complete:', response);
        sendResponse(response);
      })
      .catch(error => {
        console.error('Email analysis error:', error);
        sendResponse({ error: error.message });
      });
    return true; // Will respond asynchronously
  }
  
  if (request.type === 'generateResponse') {
    console.log('Processing response generation request');
    generateResponseWithLLM(request.analysis)
      .then(response => {
        console.log('Response generation complete:', response);
        sendResponse(response);
      })
      .catch(error => {
        console.error('Response generation error:', error);
        sendResponse({ error: error.message });
      });
    return true; // Will respond asynchronously
  }
});

async function analyzeEmailWithLLM(emailContent) {
  console.log('Starting email analysis with LLM');
  try {
    const response = await fetch('http://localhost:8000/analyze', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: emailContent
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    console.log('LLM analysis result:', result);
    return result;
  } catch (error) {
    console.error('Error in analyzeEmailWithLLM:', error);
    throw error;
  }
}

async function generateResponseWithLLM(analysis) {
  console.log('Starting response generation with LLM');
  try {
    const response = await fetch('http://localhost:8000/generate-response', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        analysis: analysis
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    console.log('LLM response generation result:', result);
    return result.response;
  } catch (error) {
    console.error('Error in generateResponseWithLLM:', error);
    throw error;
  }
} 