// ============================================
// AI NURSING COMPANION - Google Apps Script Proxy
// ============================================
//
// SETUP INSTRUCTIONS:
// 1. Go to https://script.google.com
// 2. Create a new project
// 3. Paste this entire code
// 4. Replace 'YOUR_ANTHROPIC_API_KEY' below with your actual API key
// 5. Click Deploy > New Deployment
// 6. Choose "Web app"
// 7. Set "Execute as" to "Me"
// 8. Set "Who has access" to "Anyone"
// 9. Click Deploy and copy the URL
// 10. Update the AI_API_URL in app.html with your new URL
//
// ============================================

// IMPORTANT: Replace with your actual Anthropic API key
const ANTHROPIC_API_KEY = 'YOUR_ANTHROPIC_API_KEY';

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const messages = data.messages || [];
    const systemPrompt = data.systemPrompt || '';

    // Call Anthropic API
    const response = callAnthropic(messages, systemPrompt);

    return ContentService
      .createTextOutput(JSON.stringify({ success: true, response: response }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService
      .createTextOutput(JSON.stringify({ success: false, error: error.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet(e) {
  return ContentService
    .createTextOutput(JSON.stringify({ status: 'AI Proxy is running', timestamp: new Date().toISOString() }))
    .setMimeType(ContentService.MimeType.JSON);
}

function callAnthropic(messages, systemPrompt) {
  const url = 'https://api.anthropic.com/v1/messages';

  // Format messages for Anthropic API
  const formattedMessages = messages.map(msg => ({
    role: msg.role,
    content: msg.content
  }));

  const payload = {
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1024,
    system: systemPrompt,
    messages: formattedMessages
  };

  const options = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01'
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };

  const response = UrlFetchApp.fetch(url, options);
  const responseCode = response.getResponseCode();
  const responseText = response.getContentText();

  if (responseCode !== 200) {
    console.error('Anthropic API Error:', responseText);
    throw new Error('API returned status ' + responseCode);
  }

  const result = JSON.parse(responseText);

  if (result.content && result.content[0] && result.content[0].text) {
    return result.content[0].text;
  }

  throw new Error('Unexpected API response format');
}

// Test function - run this to verify your API key works
function testAPI() {
  const testMessages = [{ role: 'user', content: 'Say hello in 5 words or less' }];
  const testSystem = 'You are a helpful assistant. Be very brief.';

  try {
    const response = callAnthropic(testMessages, testSystem);
    console.log('SUCCESS! Response:', response);
    return response;
  } catch (error) {
    console.error('FAILED:', error.message);
    return 'Error: ' + error.message;
  }
}
