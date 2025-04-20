console.log('Popup script starting to load...');

document.addEventListener('DOMContentLoaded', function() {
  console.log('Popup script loaded');
  const generateButton = document.getElementById('generateResponse');
  const statusDiv = document.getElementById('status');
  const responseDiv = document.getElementById('response');
  const copyButton = document.getElementById('copyResponse');

  console.log('Popup elements:', {
    generateButton: !!generateButton,
    statusDiv: !!statusDiv,
    responseDiv: !!responseDiv,
    copyButton: !!copyButton
  });

  if (!generateButton) {
    console.error('Generate button not found!');
    return;
  }

  generateButton.addEventListener('click', async () => {
    console.log('Generate button clicked');
    try {
      // Get the active tab
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      console.log('Active tab:', tab);
      
      if (!tab.url.includes('mail.google.com')) {
        console.log('Not on Gmail, showing error');
        showStatus('Please open Gmail to use this extension', 'error');
        return;
      }

      // Ensure content script is injected
      try {
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['content.js']
        });
        console.log('Content script injected successfully');
      } catch (error) {
        console.log('Content script might already be injected:', error);
      }

      // Send message to content script
      console.log('Sending message to content script');
      chrome.tabs.sendMessage(tab.id, { action: 'generateResponse' }, (response) => {
        console.log('Received response from content script:', response);
        if (chrome.runtime.lastError) {
          console.error('Chrome runtime error:', chrome.runtime.lastError);
          showStatus('Error: Could not communicate with Gmail. Please refresh the page and try again.', 'error');
          return;
        }
        
        if (response && response.success) {
          showStatus('Response generated successfully!', 'success');
          showResponse(response.response);
          copyButton.style.display = 'block';
        } else {
          showStatus(response?.error || 'Failed to generate response', 'error');
        }
      });
    } catch (error) {
      console.error('Error in popup script:', error);
      showStatus('Error: ' + error.message, 'error');
    }
  });

  copyButton.addEventListener('click', () => {
    const responseText = responseDiv.textContent;
    navigator.clipboard.writeText(responseText).then(() => {
      showStatus('Response copied to clipboard!', 'success');
    }).catch(err => {
      showStatus('Failed to copy response', 'error');
    });
  });

  function showStatus(message, type) {
    statusDiv.textContent = message;
    statusDiv.className = `status ${type}`;
    statusDiv.style.display = 'block';
    
    setTimeout(() => {
      statusDiv.style.display = 'none';
    }, 3000);
  }

  function showResponse(response) {
    console.log('Showing response:', response);
    if (!response) {
      console.error('No response to show');
      return;
    }
    
    // Make sure the response div exists
    if (!responseDiv) {
      console.error('Response div not found');
      return;
    }

    // Set the content and make it visible
    responseDiv.textContent = response;
    responseDiv.style.display = 'block';
    
    // Make sure the copy button is visible
    if (copyButton) {
      copyButton.style.display = 'block';
    }
    
    console.log('Response displayed successfully');
  }
});