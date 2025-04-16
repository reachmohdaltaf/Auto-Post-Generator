// joke-generator.js
const { BskyAgent } = require('@atproto/api');
const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');
const axios = require('axios');

// Load environment variables
dotenv.config();

// // Check if .env file exists, if not create it with template
// const envPath = path.join(__dirname, '.env');
// if (!fs.existsSync(envPath)) {
//   const envTemplate = `BSKY_USERNAME=your-username.bsky.social
// BSKY_PASSWORD=your-password
// GEMINI_API_KEY=your-gemini-api-key
// `;
//   fs.writeFileSync(envPath, envTemplate);
//   console.log('.env file created. Please fill in your credentials.');
//   process.exit(1);
// }

// Setup Bluesky agent
const bsky = new BskyAgent({
  service: 'https://bsky.social'
});

const MAX_TEXT_LENGTH = 150; // Set the max character length (300 graphemes)

// Truncate text if it exceeds the limit
function truncateText(text) {
  if (text.length > MAX_TEXT_LENGTH) {
    return text.substring(0, MAX_TEXT_LENGTH) + '...'; // Add an ellipsis if truncated
  }
  return text;
}

async function generateBeautifulInformation() {
  try {
    // New categories focused on beautiful information
    const categories = [
      "motivational quotes", "nature facts", "space facts",
      "historical facts", "inspirational quotes", "mindfulness facts",
      "philosophical insights", "positive affirmations",
      "scientific discoveries", "humanity achievements"
    ];

    const randomCategory = categories[Math.floor(Math.random() * categories.length)];
    const timestamp = new Date().toISOString(); // Add timestamp for uniqueness
    
    // Using axios to directly call the Gemini API with the correct endpoint
    const response = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        contents: [{
          parts: [{
            text: `Generate an interesting or beautiful piece of information related to ${randomCategory}. Current time: ${timestamp}. Format the reply in JSON: {"information": "your information here", "hashtags": ["tag1", "tag2", "tag3"]} Do not include the # symbol in the hashtags.`
          }]
        }]
      },
      {
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );

    // Extract the generated text from the response
    const generatedContent = response.data.candidates[0].content.parts[0].text;
    
    // Try to parse the response as JSON
    let parsedResponse;
    try {
      // Remove any code block formatting if present
      const cleanedResponse = generatedContent.replace(/```json|```/g, '').trim();
      parsedResponse = JSON.parse(cleanedResponse);
    } catch (err) {
      console.log("Failed to parse JSON response. Using text extraction fallback.");
      
      // Fallback: Try to extract information and hashtags from text
      const infoMatch = generatedContent.match(/(?:"information"|information):\s*(?:"([^"]+)"|'([^']+)'|([^,\n]+))/i);
      const hashtagsMatch = generatedContent.match(/(?:"hashtags"|hashtags):\s*\[(.*?)\]/i);
      
      if (infoMatch) {
        const information = infoMatch[1] || infoMatch[2] || infoMatch[3];
        let hashtags = [];
        
        if (hashtagsMatch && hashtagsMatch[1]) {
          // Extract hashtags from the array text
          hashtags = hashtagsMatch[1]
            .split(',')
            .map(tag => tag.trim().replace(/"|'/g, ''))
            .filter(tag => tag.length > 0);
        }
        
        parsedResponse = { information, hashtags };
      } else {
        // Last resort: Use the entire response as the information
        parsedResponse = { 
          information: generatedContent.substring(0, 200), 
          hashtags: ["information", "facts", "inspiration", randomCategory.replace(" ", "")] 
        };
      }
    }
    
    // Format post text with hashtags - Fix the double hashtag issue
    const { information, hashtags = ["information", "facts", "inspiration"] } = parsedResponse;
    
    // Ensure the information + hashtags do not exceed MAX_TEXT_LENGTH
    let hashtagText = (hashtags || []).map(tag => {
      // Remove # if it already exists at the beginning of the tag
      const cleanTag = tag.startsWith('#') ? tag.substring(1) : tag;
      // Remove spaces from hashtags
      return `#${cleanTag.replace(/\s+/g, '')}`;
    }).join(' ');

    let postText = `${information}\n\n${hashtagText}`;
    
    // If the total text exceeds the character limit, truncate both information and hashtags
    if (postText.length > MAX_TEXT_LENGTH) {
      const maxInformationLength = MAX_TEXT_LENGTH - hashtagText.length - 3; // Subtract space for '...' if truncated
      postText = `${truncateText(information.substring(0, maxInformationLength))}\n\n${hashtagText}`;
    }

    console.log(`Generated information on ${randomCategory}:`, postText);
    return postText;
  } catch (error) {
    console.error('Error generating information:', error.message);
    if (error.response) {
      console.error('Error details:', error.response.data);
    } else {
      console.error('No response data available');
    }
    
    // Generate a fallback piece of information
    const fallbackInformation = [
      "Did you know? A group of flamingos is called a 'flamboyance'! #nature #facts #animals",
      "The Eiffel Tower can be 15 cm taller during the summer due to the expansion of iron in the heat! #science #historicalfacts #inspiration",
      "Space is completely silent because there’s no air for sound waves to travel through. #space #science #facts"
    ];
    return fallbackInformation[Math.floor(Math.random() * fallbackInformation.length)];
  }
}

async function postToBluesky(text) {
  try {
    // Login to Bluesky
    await bsky.login({
      identifier: process.env.BSKY_USERNAME,
      password: process.env.BSKY_PASSWORD
    });
    
    // Post the information
    const response = await bsky.post({
      text: text,
      createdAt: new Date().toISOString()
    });
    
    console.log(`Posted successfully at ${new Date().toLocaleString()}`);
    return response;
  } catch (error) {
    console.error('Error posting to Bluesky:', error.message);
    return null;
  }
}

async function runInformationGenerator() {
  try {
    const informationText = await generateBeautifulInformation();
    if (informationText) {
      await postToBluesky(informationText);
    }
  } catch (error) {
    console.error('Error in information generator:', error.message);
  }
}

// Initial run
runInformationGenerator();

// Schedule to run every 2 minutes
const FIVE_MINUTES = 5 * 60 * 1000; // 5 minutes in milliseconds
setInterval(() => {
  runInformationGenerator();
}, FIVE_MINUTES);

