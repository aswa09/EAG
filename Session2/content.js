const INACTIVITY_THRESHOLD = 1 * 60 * 1000; // 1 minutes in milliseconds
let lastActivityTime = Date.now();
let isAlertActive = false;

console.log('Teams Slacker Alert: Content script loaded!'); // Debug log

// Gemini API configuration
const GEMINI_API_KEY = 'gemini_key';
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

const quirkGenPrompt = `
** Skill**
- You're a quirky AI assistant.
- You understand current day sarcasm.

** Context **
- There is a Chrome Plugin that checks user activity on Teams
- Whenever the user is inactive for a certain period of time, the plugin plays a sound and displays a message on the user's screen

** Task **
- The generated response should be done by you, the AI assistant
- The generated response should be quirky and humorous
- The generated response should not exceed 2 sentences

** Output Format **
- Always respond as a string.

** Examples **
- The following are some examples of quirk messages that you can generate:
1. "Oh look who decided to abandon their Teams chat! Your colleagues must feel so special. 🙄"
2. "Breaking news: Your Teams status isn't going to set itself to 'Active'! 🚨"

Do not use the above examples in your response, it is just the language and format of the response you should follow.

End of Instructions`;

// Create audio element for playing sound
let audio = null;
let audioEnabled = localStorage.getItem('teamsAlertSoundEnabled') === 'true';

function playSound() {
    console.log('Attempting to play sound...'); // Debug log
    if (!audioEnabled) {
        console.log('Audio not enabled yet - waiting for user interaction'); // Debug log
        return;
    }
    
    if (!audio) {
        try {
            const soundUrl = chrome.runtime.getURL('sounds/Titanic Come Back.mp3');
            console.log('Sound URL:', soundUrl); // Debug log
            audio = new Audio(soundUrl);
            audio.volume = 1.0; // Maximum volume
            console.log('Audio object created successfully'); // Debug log
            
            // Add event listeners for audio
            audio.addEventListener('play', () => {
                console.log('Audio started playing');
            });
            
            audio.addEventListener('error', (e) => {
                console.error('Audio error:', e);
                console.error('Audio error code:', audio.error.code);
                console.error('Audio error message:', audio.error.message);
                console.error('Audio readyState:', audio.readyState);
            });
            
            audio.addEventListener('loadeddata', () => {
                console.log('Audio file loaded successfully');
                console.log('Audio readyState:', audio.readyState);
            });
            
            audio.addEventListener('canplay', () => {
                console.log('Audio can play now');
            });
            
        } catch (error) {
            console.error('Error creating audio:', error); // Debug log
            return;
        }
    }
    
    // Reset audio to start if it's already playing
    audio.currentTime = 0;
    
    // Play the sound
    audio.play().catch(error => {
        console.error('Error playing sound:', error);
        console.error('Audio readyState:', audio.readyState);
        // Try to provide more specific error information
        if (error.name === 'NotAllowedError') {
            console.log('Sound blocked by browser - needs user interaction first');
            audioEnabled = false; // Reset the enabled state
            localStorage.removeItem('teamsAlertSoundEnabled'); // Clear the stored preference
        } else if (error.name === 'NotFoundError') {
            console.log('Sound file not found - check if file exists in sounds folder');
        }
    });
}

async function getRandomMessage() {
    try {
        const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                contents: [{
                    parts: [{
                        text: quirkGenPrompt
                    }]
                }]
            })
        });

        if (!response.ok) {
            throw new Error('Failed to fetch message from Gemini API');
        }

        const data = await response.json();
        return data.candidates[0].content.parts[0].text;
    } catch (error) {
        console.error('Error fetching message:', error);
        console.error('Error details:', {
            message: error.message,
            stack: error.stack,
            name: error.name
        });
        throw error; // Re-throw the error to handle it in showAlert
        
        // Fallback messages in case of API failure
        /*
        const fallbackMessages = [
            "Oh look who decided to abandon their Teams chat! Your colleagues must feel so special. 🙄",
            "Breaking news: Your Teams status isn't going to set itself to 'Active'! 🚨",
            "Did you fall into a black hole? Because your Teams activity sure did! 🕳️"
        ];
        return fallbackMessages[Math.floor(Math.random() * fallbackMessages.length)];
        */
    }
}

async function showAlert() {
    console.log('showAlert function called!'); // Debug log
    if (!isAlertActive) {
        console.log('Creating new alert...'); // Debug log
        isAlertActive = true;
        const message = await getRandomMessage();
        
        // Create and style notification div
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: #ff4444;
            color: white;
            padding: 40px;
            border-radius: 12px;
            z-index: 999999;
            min-width: 400px;
            max-width: 600px;
            box-shadow: 0 8px 16px rgba(0,0,0,0.3);
            font-size: 24px;
            animation: shake 0.5s infinite;
            text-align: center;
        `;
        
        // Add shake animation and styles
        const style = document.createElement('style');
        style.textContent = `
            @keyframes shake {
                0%, 100% { transform: translate(-50%, -50%) rotate(0deg); }
                25% { transform: translate(-50%, -50%) rotate(-1deg); }
                75% { transform: translate(-50%, -50%) rotate(1deg); }
            }
            .enable-sound-btn {
                background: #ffffff;
                color: #ff4444;
                border: none;
                padding: 12px 24px;
                border-radius: 6px;
                margin-top: 20px;
                cursor: pointer;
                font-weight: bold;
                display: block;
                width: 100%;
                font-size: 18px;
            }
            .enable-sound-btn:hover {
                background: #eeeeee;
            }
            .close-btn {
                background: #ffffff;
                color: #ff4444;
                border: none;
                padding: 12px 24px;
                border-radius: 6px;
                margin-top: 10px;
                cursor: pointer;
                font-weight: bold;
                display: block;
                width: 100%;
                font-size: 18px;
            }
            .close-btn:hover {
                background: #eeeeee;
            }
            .message-text {
                margin-bottom: 20px;
                font-size: 28px;
                line-height: 1.4;
            }
        `;
        document.head.appendChild(style);
        
        // Create message div
        const messageDiv = document.createElement('div');
        messageDiv.className = 'message-text';
        messageDiv.textContent = message;
        notification.appendChild(messageDiv);
        
        let audioInterval; // For looping audio
        
        const startLoopingAudio = () => {
            audioEnabled = true; // Enable audio
            localStorage.setItem('teamsAlertSoundEnabled', 'true'); // Save the preference
            playSound(); // Play immediately
            audioInterval = setInterval(() => {
                playSound();
            }, 3000); // Loop every 3 seconds
        };
        
        // Create enable sound button
        const enableSoundBtn = document.createElement('button');
        enableSoundBtn.textContent = audioEnabled ? '🔊 Sound Enabled!' : '🔊 Enable Sound Alerts';
        enableSoundBtn.className = 'enable-sound-btn';
        if (audioEnabled) {
            enableSoundBtn.style.background = '#90EE90';
            enableSoundBtn.style.color = '#006400';
        }
        
        enableSoundBtn.onclick = (e) => {
            e.stopPropagation();
            startLoopingAudio();
            enableSoundBtn.textContent = '🔊 Sound Enabled!';
            enableSoundBtn.style.background = '#90EE90';
            enableSoundBtn.style.color = '#006400';
        };
        
        // Create close button
        const closeBtn = document.createElement('button');
        closeBtn.textContent = '❌ Close Alert';
        closeBtn.className = 'close-btn';
        closeBtn.onclick = () => {
            if (audioInterval) {
                clearInterval(audioInterval);
            }
            notification.remove();
            isAlertActive = false;
            console.log('Alert manually closed'); // Debug log
        };
        
        // Only show enable button if sound isn't enabled yet
        if (!audioEnabled) {
            notification.appendChild(enableSoundBtn);
        } else {
            startLoopingAudio(); // Start audio immediately if already enabled
        }
        
        notification.appendChild(closeBtn);
        document.body.appendChild(notification);
        console.log('Alert notification created and added to page'); // Debug log
    }
}

function checkActivity() {
    const currentTime = Date.now();
    const timeSinceLastActivity = currentTime - lastActivityTime;
    console.log(`Time since last activity: ${Math.floor(timeSinceLastActivity / 1000)} seconds`); // Debug log
    if (timeSinceLastActivity > INACTIVITY_THRESHOLD) {
        console.log('Inactivity threshold reached, showing alert...'); // Debug log
        showAlert();
    }
}

// Reset timer on any user activity
const resetTimer = () => {
    lastActivityTime = Date.now();
    console.log('Activity detected, timer reset'); // Debug log
};

// Monitor user activity
document.addEventListener('mousemove', resetTimer);
document.addEventListener('keypress', resetTimer);
document.addEventListener('click', resetTimer);
document.addEventListener('scroll', resetTimer);

// Check activity every 30 seconds
setInterval(checkActivity, 30000);

console.log('Teams Slacker Alert: All event listeners and timers set up!'); // Debug log 