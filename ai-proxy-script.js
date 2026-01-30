// ============================================
// AI NURSING COMPANION - Google Apps Script (GROQ)
// ============================================
//
// ADD THIS CODE TO YOUR EXISTING GOOGLE APPS SCRIPT
//
// Steps:
// 1. Go to https://console.groq.com and sign up (free)
// 2. Create an API key
// 3. Replace 'YOUR_GROQ_API_KEY' below with your key
// 4. Add this code to your existing script
// 5. Redeploy (Deploy > Manage Deployments > Edit > New Version)
//
// ============================================

// IMPORTANT: Replace with your Groq API key
const GROQ_API_KEY = 'YOUR_GROQ_API_KEY';

// ============================================
// ADD THIS CHECK AT THE TOP OF YOUR EXISTING doPost FUNCTION:
// ============================================
/*

function doPost(e) {
  // === ADD THIS BLOCK AT THE TOP ===
  if (e.postData && e.postData.contents) {
    try {
      const jsonData = JSON.parse(e.postData.contents);
      if (jsonData.messages && jsonData.systemPrompt) {
        return handleAIRequest(jsonData);
      }
    } catch(err) {
      // Not JSON AI request, continue with normal flow
    }
  }
  // === END OF ADDED BLOCK ===

  // ... rest of your existing doPost code ...
}

*/
// ============================================

function handleAIRequest(data) {
  try {
    const messages = data.messages || [];
    const systemPrompt = data.systemPrompt || '';
    const response = callGroq(messages, systemPrompt);

    return ContentService
      .createTextOutput(JSON.stringify({ success: true, response: response }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService
      .createTextOutput(JSON.stringify({ success: false, error: error.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function callGroq(messages, systemPrompt) {
  const url = 'https://api.groq.com/openai/v1/chat/completions';

  // Build messages array with system prompt
  const allMessages = [
    { role: 'system', content: systemPrompt },
    ...messages.map(msg => ({ role: msg.role, content: msg.content }))
  ];

  const payload = {
    model: 'llama-3.3-70b-versatile',  // Fast and capable model
    messages: allMessages,
    max_tokens: 1024,
    temperature: 0.7
  };

  const options = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + GROQ_API_KEY
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };

  const response = UrlFetchApp.fetch(url, options);
  const responseCode = response.getResponseCode();
  const responseText = response.getContentText();

  if (responseCode !== 200) {
    console.error('Groq API Error:', responseText);
    throw new Error('API returned status ' + responseCode);
  }

  const result = JSON.parse(responseText);

  if (result.choices && result.choices[0] && result.choices[0].message) {
    return result.choices[0].message.content;
  }

  throw new Error('Unexpected API response format');
}

// Test function - run this in Apps Script to verify your API key works
function testGroqAPI() {
  const testMessages = [{ role: 'user', content: 'Say hello in 5 words or less' }];
  const testSystem = 'You are a helpful assistant. Be very brief.';

  try {
    const response = callGroq(testMessages, testSystem);
    console.log('SUCCESS! Response:', response);
    return response;
  } catch (error) {
    console.error('FAILED:', error.message);
    return 'Error: ' + error.message;
  }
}
