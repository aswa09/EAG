const INACTIVITY_THRESHOLD = 1 * 60 * 1000; // 1 minutes in milliseconds
let lastActivityTime = Date.now();
let isAlertActive = false;

console.log('Teams Slacker Alert: Content script loaded!'); // Debug log

const sarcasticMessages = [
    "Oh look who decided to abandon their Teams chat! Your colleagues must feel so special. 🙄",
    "Breaking news: Your Teams status isn't going to set itself to 'Active'! 🚨",
    "Did you fall into a black hole? Because your Teams activity sure did! 🕳️",
    "Your keyboard misses you. It's been writing sad poetry about your absence. 😢",
    "Alert: Your 'quick coffee break' has now lasted longer than most Netflix series. ☕",
    "Congratulations! You've achieved a new personal record in Teams avoidance! 🏆",
    "Plot twist: Teams actually needs you to be here to work. Shocking, right? 😱",
    "Your mouse called. It's filing for abandonment. 🐭"
];

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
            });
            
            audio.addEventListener('loadeddata', () => {
                console.log('Audio file loaded successfully');
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

function getRandomMessage() {
    return sarcasticMessages[Math.floor(Math.random() * sarcasticMessages.length)];
}

function showAlert() {
    console.log('showAlert function called!'); // Debug log
    if (!isAlertActive) {
        console.log('Creating new alert...'); // Debug log
        isAlertActive = true;
        const message = getRandomMessage();
        
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