/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Imports remain the same
import { GoogleGenerativeAI as GoogleGenAI, Part } from '@google/generative-ai'; // Use full name for clarity maybe? Check actual export
// Or just: import { GoogleGenAI, Part } from '@google/genai';
import { marked } from 'marked';

// --- IMPORTANT ---
// Using process.env.API_KEY - Requires Vite config
const apiKey = process.env.API_KEY;

if (!apiKey) {
  console.error("API key not found in process.env.API_KEY. Ensure it's configured correctly.");
}
const ai = new GoogleGenAI(apiKey || ''); // Pass API key directly to constructor

// --- Get DOM Elements ---
// (Keep all element selections as before)
const promptInput = document.querySelector('#prompt-input') as HTMLTextAreaElement;
const generateBtn = document.querySelector('#generate-btn') as HTMLButtonElement;
const addImageBtn = document.querySelector('#add-image-btn') as HTMLButtonElement;
const imageUpload = document.querySelector('#image-upload') as HTMLInputElement;
const imagePreviewContainer = document.querySelector('#image-preview-container') as HTMLDivElement;
const imagePreview = document.querySelector('#image-preview') as HTMLImageElement;
const removeImageBtn = document.querySelector('#remove-image') as HTMLButtonElement;
const userQueryContainer = document.querySelector('#user-query-container') as HTMLDivElement;
const errorContainer = document.querySelector('#error-container') as HTMLDivElement;
const resultsContainer = document.querySelector('#results-container') as HTMLDivElement;
const cardsContainer = document.querySelector('#cards-container') as HTMLDivElement;
const loadingIndicator = document.querySelector('#loading-indicator') as HTMLDivElement;
const downloadBtn = document.querySelector('#download-grid-btn') as HTMLButtonElement;
const gridSizeSelect = document.querySelector('#grid-size') as HTMLSelectElement;
const exampleButtons = document.querySelectorAll('.example-btn');
const cancelBtn = document.querySelector('#cancel-btn') as HTMLButtonElement;

// --- State Variables ---
// (Keep all state variables as before)
let uploadedImage: File | null = null;
let uploadedImageData: string | null = null;
let generatedCards: { text: string, imageUrl: string }[] = [];
let isGenerating = false;
let abortController: AbortController | null = null;

// --- Prompt Configuration (Fun & Entertaining - OPTION 1 Applied) ---
const additionalInstructions = `
Alright, listen up, you digital genius! Your mission, should you choose to accept it (and you MUST), is to explain the user's prompt using... wait for it... **A METAPHORICAL ARMY OF TINY, ADORABLY INAPPROPRIATE CATS!**

Here's the lowdown:
1.  **Craft a Story:** Weave a short, *wildly* inappropriate narrative starring these felonious felines. It needs to be a satirical explanation of the original topic. Think edgy, funny, maybe a little shocking.
2.  **Sentence Style:** Keep 'em short, punchy, and dripping with mature (read: potentially profane, definitely adult-themed) wit.
3.  **Language:** Don't hold back. Explicit language isn't just okay, it's *encouraged*. Let the expletives flow like cheap catnip!
4.  **Illustrations ARE KEY:** For *every single sentence*, conjure up a *cute* but equally *inappropriate* illustration. Minimalist black ink on white, like a disturbed child's doodles found in a back alley. Simple, stark, and wrong.
5.  **No Fluff:** Ditch the pleasantries. No intro, no commentary. Just launch straight into the cat-astrophe.
6.  **Finish the Job:** Keep the story and drawings coming until the explanation is complete. Don't leave us hanging!

Now go forth and unleash the hilariously inappropriate kitty chaos! Make it weird. Make it memorable.`;


// --- Image Handling, Card Creation, Grid Generation, Download (Keep Original Logic) ---
// (Functions addImageBtn listener, imageUpload listener, removeImageBtn listener, createCard, generateGridImage, downloadBtn listener remain the same as in the previous response)
// Handle image upload via the button
addImageBtn.addEventListener('click', () => {
  imageUpload.click();
});

// Process the selected image
imageUpload.addEventListener('change', (e: Event) => {
  const target = e.target as HTMLInputElement;
  const file = target.files?.[0];

  if (file) {
    uploadedImage = file;
    const reader = new FileReader();

    reader.onload = (event) => {
      if (event.target?.result) {
        uploadedImageData = event.target.result as string;
        imagePreview.src = uploadedImageData;
        imagePreviewContainer.removeAttribute('hidden');
        addImageBtn.textContent = 'Change Image'; // Keep this UI improvement
      }
    };

    reader.readAsDataURL(file);
  }
});

// Remove the uploaded image
removeImageBtn.addEventListener('click', () => {
  uploadedImage = null;
  uploadedImageData = null;
  imagePreview.src = '';
  imagePreviewContainer.setAttribute('hidden', '');
  imageUpload.value = ''; // Reset file input
  addImageBtn.textContent = 'Add an Image'; // Keep this UI improvement
});

// Create a card element for a text-image pair
function createCard(text: string, imageUrl: string): HTMLElement {
  const card = document.createElement('div');
  card.className = 'card';

  const image = document.createElement('img');
  image.src = imageUrl;
  image.className = 'card-image';
  image.alt = 'Tiny cat illustration'; // Alt text improvement
  card.appendChild(image);

  const content = document.createElement('div');
  content.className = 'card-content';
  content.innerHTML = text; // Assumes marked parsed HTML is passed
  card.appendChild(content);

  generatedCards.push({ text, imageUrl });
  return card;
}

// Function to create a downloadable grid image of the cards
async function generateGridImage(gridSize: number): Promise<string> {
  const cardWidth = 300;
  const cardHeight = 400;
  const padding = 10;
  const cols = gridSize;
  const rows = Math.ceil(Math.min(generatedCards.length, gridSize * gridSize) / cols);

  if (rows === 0) return '';

  const canvasWidth = cols * (cardWidth + padding) - padding;
  const canvasHeight = rows * (cardHeight + padding) - padding;

  const canvas = document.createElement('canvas');
  canvas.width = canvasWidth;
  canvas.height = canvasHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  ctx.fillStyle = '#25272e';
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);

  const maxCards = Math.min(generatedCards.length, gridSize * gridSize);
  const imageLoadPromises = [];

  for (let i = 0; i < maxCards; i++) {
    const row = Math.floor(i / cols);
    const col = i % cols;

    const x = col * (cardWidth + padding);
    const y = row * (cardHeight + padding);

    const promise = new Promise<void>((resolve, reject) => { // Add reject
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
         try {
            // Draw a card background
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(x, y, cardWidth, cardWidth);

            // Draw the image
            ctx.drawImage(img, x, y, cardWidth, cardWidth);

            // Draw text area background
            ctx.fillStyle = '#25272e';
            ctx.fillRect(x, y + cardWidth, cardWidth, cardHeight - cardWidth);

            // Draw text
            ctx.fillStyle = '#e5e7eb';
            ctx.font = '16px "Indie Flower", cursive';

            // Wrap and draw the text (Original simplified logic)
            const maxWidth = cardWidth - 20; // 10px padding each side
            const lineHeight = 24; // From original example calculation

             // Assuming generatedCards[i].text contains HTML from marked
            const plainText = new DOMParser().parseFromString(generatedCards[i].text, 'text/html').body.textContent || '';

            const words = plainText.split(' ');
            let line = '';
            let lineY = y + cardWidth + 25; // Initial Y position

            for (let n = 0; n < words.length; n++) {
               const testLine = line + words[n] + ' ';
               const metrics = ctx.measureText(testLine);
               const testWidth = metrics.width;

               if (testWidth > maxWidth && n > 0) {
                 ctx.fillText(line.trim(), x + 10, lineY); // Draw previous line
                 line = words[n] + ' '; // Start new line
                 lineY += lineHeight;
                  // Basic check to prevent drawing outside allocated area
                  if (lineY > y + cardHeight - 15) {
                       line += '...'; // Indicate truncation if adding next line goes too far
                       break;
                  }
               } else {
                 line = testLine;
               }
            }
            // Draw the last line, checking height first
             if (lineY <= y + cardHeight - 15) {
                ctx.fillText(line.trim(), x + 10, lineY);
            }

            resolve();
        } catch (drawError) {
            console.error("Error drawing card:", drawError);
            reject(drawError); // Reject promise on error
        }
      };
       img.onerror = (err) => { // Add onerror handling
         console.error("Error loading card image:", img.src, err);
         // Optionally draw a placeholder on error
         ctx.fillStyle = '#555'; // Error background
         ctx.fillRect(x, y, cardWidth, cardWidth);
         ctx.fillStyle = '#fff';
         ctx.font = '14px Arial';
         ctx.textAlign = 'center';
         ctx.fillText('Load Error', x + cardWidth / 2, y + cardWidth / 2);
         ctx.textAlign = 'left'; // Reset alignment
         reject(new Error(`Failed to load image ${img.src}`));
       }
      img.src = generatedCards[i].imageUrl;
    });

    imageLoadPromises.push(promise);
  }

   try {
      await Promise.all(imageLoadPromises); // Wait for all drawings
      return canvas.toDataURL('image/png');
   } catch (error) {
       console.error("One or more card images failed to load or draw.", error);
       // Decide how to handle this - return placeholder? return partial? return empty?
       // Returning potentially partial canvas for now:
       return canvas.toDataURL('image/png'); // Or return '' to indicate failure
   }
}

// Download the grid image
downloadBtn.addEventListener('click', async () => {
  if (generatedCards.length === 0 || isGenerating) return;

  downloadBtn.disabled = true;
  downloadBtn.textContent = 'Generating Grid...'; // Keep UI update

  try { // Add try/catch around grid generation
      const gridSize = parseInt(gridSizeSelect.value);
      const dataUrl = await generateGridImage(gridSize);

      if (dataUrl) { // Check if URL generation succeeded
          const link = document.createElement('a');
          link.href = dataUrl;
          link.download = `tiny-cats-explanation-${gridSize}x${gridSize}.png`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
      } else {
          console.error("Grid image generation failed.");
          // Optionally inform the user via errorContainer
          errorContainer.textContent = "Failed to generate the grid image.";
          errorContainer.removeAttribute('hidden');
      }
  } catch (error) {
      console.error("Error generating or downloading grid image:", error);
      errorContainer.textContent = "An error occurred while generating the download image.";
      errorContainer.removeAttribute('hidden');
  } finally {
      downloadBtn.disabled = false; // Re-enable regardless of success/fail
      downloadBtn.textContent = 'Download Grid';
  }
});

// --- Error Parsing (Original Logic) ---
function parseError(error: any): string {
  if (typeof error === 'string') {
    const regex = /{"error":(.*)}/gm;
    const m = regex.exec(error);
    try {
      if (m && m[1]) {
        const e = m[1];
        const err = JSON.parse(e);
        return err.message || m[1] || error;
      }
      return error;
    } catch (e) {
      return error;
    }
  }
  if (error instanceof Error) {
      return error.message;
  }
  return error.toString();
}

// --- Loading Indicator (Original Logic) ---
function showLoading(message: string = 'Generating your cat explanation...') {
  const loadingMessage = loadingIndicator.querySelector('p');
  if (loadingMessage) {
    loadingMessage.textContent = message;
  }
  loadingIndicator.removeAttribute('hidden');
}

function hideLoading() {
  loadingIndicator.setAttribute('hidden', '');
}

// --- Main Generation Function (Using generateContentStream) ---
async function generate(message: string) {
  if (isGenerating || !message.trim()) return;

  isGenerating = true;
  abortController = new AbortController(); // Still create it, though direct use might vary

  promptInput.disabled = true;
  generateBtn.disabled = true;
  addImageBtn.disabled = true;
  imageUpload.disabled = true;
  downloadBtn.disabled = true;

  userQueryContainer.innerHTML = '';
  errorContainer.innerHTML = '';
  errorContainer.setAttribute('hidden', '');
  cardsContainer.innerHTML = '';
  generatedCards = [];
  resultsContainer.setAttribute('hidden', '');

  // Display User Query
  const queryTextNode = document.createTextNode(message);
  userQueryContainer.appendChild(queryTextNode);
  if (uploadedImageData) {
      const uploadedImageElement = document.createElement('img');
      uploadedImageElement.src = uploadedImageData;
      uploadedImageElement.alt = 'Uploaded image provided with prompt';
      uploadedImageElement.style.maxWidth = '80px';
      uploadedImageElement.style.maxHeight = '80px';
      uploadedImageElement.style.marginLeft = '10px';
      uploadedImageElement.style.verticalAlign = 'middle';
      userQueryContainer.appendChild(uploadedImageElement);
  }
  userQueryContainer.removeAttribute('hidden');

  showLoading();

  try {
    // --- Get the generative model instance ---
    // NOTE: Model name might need adjustment if 'gemini-2.0-flash-exp' is not valid here
    // or if specific features require a different model like 'gemini-1.5-flash' or 'gemini-pro-vision' etc.
    // Check Google AI documentation for models compatible with generateContentStream and image output.
    // 'gemini-1.5-flash' often works well for mixed text/image generation.
    console.log("Getting model instance: gemini-1.5-flash"); // Or try gemini-2.0-flash-exp first
    const model = ai.getGenerativeModel({
        model: "gemini-1.5-flash", // TRY THIS MODEL
        generationConfig: {
            responseMimeType: "application/json", // Request structured JSON for easier parsing
             // Temperature, topP etc. could be set here if needed
        },
        // Safety settings can be added here too if needed
    });
    console.log("Model instance obtained.");


    // --- Prepare message parts ---
    const combinedMessage = message + '\n\n' + additionalInstructions;
    const messageParts: Part[] = [{ text: combinedMessage }];
    console.log("Prepared messageParts for generateContentStream:", JSON.stringify(messageParts));


    // --- Send Request using generateContentStream ---
    console.log("Calling generateContentStream...");
    const result = await model.generateContentStream({
        contents: [{ role: "user", parts: messageParts }], // Use the 'contents' structure
    });
    console.log("generateContentStream call succeeded, processing response stream...");


    // Timeout is less critical now as stream starts immediately, but keep for long waits
    const timeoutId = setTimeout(() => {
        if (isGenerating && generatedCards.length === 0) { // Check if cards are being generated
             showLoading('Still working... Fetching the first cat panel.');
        }
     }, 15000);


    resultsContainer.removeAttribute('hidden'); // Show results container earlier
    showLoading('Creating your cat explanation...');

    // --- Process Stream (Potentially different structure) ---
    let currentText = '';
    let currentImage = null;
    let cardCount = 0;
    let streamReceived = false;
    let aggregatedResponseText = ''; // For debugging


    for await (const chunk of result.stream) {
       streamReceived = true;
        // Log the raw chunk structure to understand it
       // console.log("Received stream chunk:", JSON.stringify(chunk)); // Uncomment for debugging

       if (!isGenerating) break; // Check cancellation flag

       try {
           // generateContentStream often directly returns objects with a 'parts' array
           // No 'candidates' layer usually. Need to check actual chunk structure.
           const parts = chunk.parts; // Adjust based on actual chunk structure logging
           // Also, response might contain functionCalls or other data. We only care about parts.

           if (!parts || !Array.isArray(parts)) {
               // If chunk is text-only (sometimes happens), aggregate it
                const chunkText = chunk.text?.(); // Safely call text() method if it exists
                if (chunkText) {
                    aggregatedResponseText += chunkText;
                    console.log("Aggregated text:", aggregatedResponseText); // Log aggregated text
                     // Handle potentially incomplete JSON/markdown before trying to process
                     // We might need a more robust parser here that handles partial structures.
                }
                continue; // Skip chunks without parts array if expecting parts
            }


           for (const part of parts) {
               if (part.text) {
                   currentText += part.text;
               } else if (part.inlineData && part.inlineData.data) {
                   try {
                       const imageData = `data:${part.inlineData.mimeType || 'image/png'};base64,${part.inlineData.data}`;
                       currentImage = imageData;
                   } catch (e) {
                       console.error('Error processing image data from stream:', e);
                       currentImage = null;
                   }
               }

               // --- Logic to create card (needs refinement) ---
               // This part is tricky with generateContentStream as text and image might not align perfectly
               // in chunks. We might need to accumulate text and process when an image arrives.
               // For simplicity, let's keep the original logic and see if it works well enough.
               if (currentText.trim() && currentImage) {
                   try {
                       const parsedText = await marked.parse(currentText.trim());
                       const card = createCard(parsedText, currentImage);
                       cardsContainer.appendChild(card);
                       cardCount++;
                       showLoading(`Creating your cat explanation... ${cardCount} panels so far`);
                       currentText = '';
                       currentImage = null;
                   } catch (parseOrCardError) {
                       console.error("Error parsing markdown or creating card:", parseOrCardError);
                       currentText = ''; // Reset even on error
                       currentImage = null;
                   }
               }
           } // end parts loop
       } catch (chunkProcessingError) {
           console.error("Error processing chunk content:", chunkProcessingError);
           console.error("Problematic chunk:", JSON.stringify(chunk)); // Log the failing chunk
       }
    } // end stream loop

     clearTimeout(timeoutId); // Clear timeout once stream finishes


    // --- Handle any remaining text ---
    if (currentText.trim()) {
       console.warn("Stream ended with leftover text (generateContentStream):", currentText.trim());
        try {
           const parsedText = await marked.parse(currentText.trim());
           const finalImage = currentImage || 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzAwIiBoZWlnaHQ9IjMwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZmZmZmZmIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxNCIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZmlsbD0iIzk5OTk5OSI+Text Only</text></svg>';
           const card = createCard(parsedText, finalImage);
           cardsContainer.appendChild(card);
           cardCount++;
         } catch (e) {
           console.error("Error handling remaining text:", e);
         }
    }

    if (!streamReceived && isGenerating) {
      throw new Error("Received no response stream from generateContentStream.");
    }

    hideLoading();

  } catch (e) {
    console.error('<<< Generation Error Caught (generateContentStream) >>>:', e);
    hideLoading();
    const errorMessage = parseError(e);
     if ((e as Error).name === 'AbortError') {
         errorContainer.textContent = 'Generation cancelled by user.';
     } else {
         // More detailed error reporting
         console.error("Error Details:", JSON.stringify(e, null, 2));
         errorContainer.textContent = `Generation Failed: ${errorMessage}. Check console for details.`;
     }
    errorContainer.removeAttribute('hidden');

  } finally {
    promptInput.disabled = false;
    generateBtn.disabled = false;
    addImageBtn.disabled = false;
    imageUpload.disabled = false;
    downloadBtn.disabled = generatedCards.length === 0;
    isGenerating = false;
    abortController = null;
  }
}

// --- Cancel Button (Original Logic Style) ---
// (Keep the cancel button listener as before)
if (cancelBtn) {
   cancelBtn.addEventListener('click', () => {
     if (isGenerating) {
       console.log("Cancel requested.");
       isGenerating = false;
       if (abortController) {
          abortController.abort(); // Attempt to signal cancellation
       }
       hideLoading();
       errorContainer.textContent = 'Generation cancelled by user.';
       errorContainer.removeAttribute('hidden');
       promptInput.disabled = false;
       generateBtn.disabled = false;
       addImageBtn.disabled = false;
       imageUpload.disabled = false;
       downloadBtn.disabled = generatedCards.length === 0;
     }
   });
} else {
    console.warn("Cancel button element not found in the HTML.");
}


// --- Event Listeners (Original Logic) ---
// (Keep the generateBtn, promptInput, exampleButtons listeners as before)
generateBtn.addEventListener('click', () => {
  const message = promptInput.value.trim();
  if (message && !isGenerating) {
    generate(message);
  }
});

promptInput.addEventListener('keydown', (e: KeyboardEvent) => {
  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
    e.preventDefault();
    const message = promptInput.value.trim();
    if (message && !isGenerating) {
      generate(message);
    }
  }
});

exampleButtons.forEach((button) => {
  button.addEventListener('click', () => {
    const exampleText = button.textContent?.trim() || '';
    if (exampleText && !isGenerating) {
      promptInput.value = exampleText;
      removeImageBtn.click();
      generate(exampleText);
    }
  });
});


// --- Initial Setup ---
// (Keep initial setup logic as before)
downloadBtn.disabled = true;
if (!apiKey) {
    generateBtn.disabled = true;
    promptInput.disabled = true;
    promptInput.placeholder = "API Key not configured. Please check setup.";
     errorContainer.textContent = "API Key missing. Please configure process.env.API_KEY for your environment.";
     errorContainer.removeAttribute('hidden');
}