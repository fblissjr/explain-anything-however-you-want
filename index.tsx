// index.tsx
/**
 * forked from "Explain Things with Lots of Tiny Cats": https://aistudio.google.com/apps/bundled/tiny_cats
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {GoogleGenAI} from '@google/genai'; // Use named import as per docs/original request
import {marked} from 'marked';

// --- API Key Handling ---
// IMPORTANT: Replace with your actual API key mechanism
// Using process.env assumes a build environment like Vite, Webpack, etc.
// Never expose your key directly in client-side code for production.
const API_KEY = process.env.API_KEY;

if (!API_KEY) {
    const errorDiv = document.querySelector('#error');
    // Display error prominently if key is missing
    if (errorDiv) { errorDiv.innerHTML = '<strong>FATAL ERROR: API Key is missing. Please configure API_KEY environment variable.</strong>'; errorDiv.removeAttribute('hidden'); }
    console.error("API_KEY environment variable not set.");
    throw new Error("API_KEY missing - Cannot initialize GoogleGenAI.");
}
// --- END API Key Handling ---


const ai = new GoogleGenAI({apiKey: API_KEY});

// --- Model/Chat Setup ---
// Model specifically for the simple text-based example generation
// This creates a ChatSession instance.
const exampleGenerationChat = ai.chats.create({ // Renamed for clarity
  model: 'gemini-2.0-flash-exp',
  config: {
    responseModalities: ['TEXT'],
    temperature: 1.25,
    topP: 0.95,
  },
  history: [], // Start with empty history for each generation
});

// Chat object setup exactly like the original, for the main explanation generation
// This also creates a distinct ChatSession instance.
const mainGenerationChat = ai.chats.create({ // Renamed for clarity
  model: 'gemini-2.0-flash-exp',
  config: {
    responseModalities: ['TEXT', 'IMAGE'],
    temperature: 1.25,
    topP: 0.95,
  },
  history: [], // Start with empty history for each generation
});

// This also creates a distinct ChatSession instance.
const mainGenerationChat2 = ai.chats.create({ // Renamed for clarity
  model: 'gemini-2.0-flash-exp',
  config: {
    responseModalities: ['TEXT', 'IMAGE'],
    temperature: 1.25,
    topP: 0.95,
  },
  history: [], // Start with empty history for each generation
});
// --- END Model/Chat Setup ---
// DO NOT CHANGE ANYTHING ABOVE THIS

// --- DOM Elements ---
const userInput = document.querySelector('#input') as HTMLTextAreaElement;
const modelOutput = document.querySelector('#output') as HTMLDivElement;
const slideshow = document.querySelector('#slideshow') as HTMLDivElement;
const errorContainer = document.querySelector('#error') as HTMLDivElement;
const examplesList = document.querySelector('#examples') as HTMLUListElement;
const customizationControls = document.querySelector('.customization-controls') as HTMLFieldSetElement;
const subjectSelect = document.querySelector('#subject-select') as HTMLSelectElement;
const moodSelect = document.querySelector('#mood-select') as HTMLSelectElement;
const drawingStyleSelect = document.querySelector('#drawing-style-select') as HTMLSelectElement;
const genreSelect = document.querySelector('#genre-select') as HTMLSelectElement;
const perspectiveSelect = document.querySelector('#perspective-select') as HTMLSelectElement;
const settingSelect = document.querySelector('#setting-select') as HTMLSelectElement;
const subjectCustomInput = document.querySelector('#subject-custom-input') as HTMLInputElement;
const moodCustomInput = document.querySelector('#mood-custom-input') as HTMLInputElement;
const drawingStyleCustomInput = document.querySelector('#drawing-style-custom-input') as HTMLInputElement;
const genreCustomInput = document.querySelector('#genre-custom-input') as HTMLInputElement;
const perspectiveCustomInput = document.querySelector('#perspective-custom-input') as HTMLInputElement;
const settingCustomInput = document.querySelector('#setting-custom-input') as HTMLInputElement;
const maturitySlider = document.querySelector('#maturity-slider') as HTMLInputElement;
const maturityValueDisplay = document.querySelector('#maturity-value') as HTMLSpanElement;
const insanitySlider = document.querySelector('#insanity-slider') as HTMLInputElement;
const insanityValueDisplay = document.querySelector('#insanity-value') as HTMLSpanElement;
const downloadControls = document.querySelector('#download-controls') as HTMLDivElement;
const downloadInfo = document.querySelector('#download-info') as HTMLParagraphElement;
const gridSizeSelect = document.querySelector('#grid-size') as HTMLSelectElement;
const downloadBtn = document.querySelector('#download-grid-btn') as HTMLButtonElement;


// --- State ---
let generatedSlidesData: { text: string, imageUrl: string }[] = [];
let isGenerating = false;
let isFetchingExamples = false;


// --- Helper Functions ---
async function addSlide(text: string, imageElement: HTMLImageElement) {
    const slide = document.createElement('div'); slide.className = 'slide';
    const clonedImage = imageElement.cloneNode(true) as HTMLImageElement;
    const caption = document.createElement('div'); caption.innerHTML = await marked.parse(text);
    slide.append(clonedImage); slide.append(caption); slideshow.append(slide);
    generatedSlidesData.push({ text: text, imageUrl: imageElement.src });
}

function parseError(error: any): string {
    if (typeof error === 'string') { if (error.includes('[GoogleGenerativeAI Error]:')) return error; try { const m = /{"error":(.*)}/gm.exec(error); if (m && m[1]) return JSON.parse(m[1]).message || 'Unknown JSON error'; } catch { /* Ignore */ } return error; } if (error instanceof Error) return error.message; if (error?.message) return String(error.message); return 'An unknown error occurred.';
}

async function generateGridImage(gridSize: number): Promise<string> {
    if (generatedSlidesData.length === 0) return '';
    const slidePadding = 30; const imageRenderHeight = 350; const estimatedTextHeight = 120;
    const cardWidth = 400 - (slidePadding * 2); const cardHeight = imageRenderHeight + estimatedTextHeight + 25;
    const padding = 20; const cols = gridSize; const rows = Math.ceil(generatedSlidesData.length / cols);
    const canvasWidth = cols * (cardWidth + padding) - padding; const canvasHeight = rows * (cardHeight + padding) - padding;
    const canvas = document.createElement('canvas'); canvas.width = canvasWidth; canvas.height = canvasHeight;
    const ctx = canvas.getContext('2d'); if (!ctx) return '';
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, canvasWidth, canvasHeight); // White canvas background
    const promises = generatedSlidesData.map((cardData, i) => new Promise<void>((resolve, reject) => {
        const row = Math.floor(i / cols); const col = i % cols; const x = col * (cardWidth + padding); const y = row * (cardHeight + padding);
        const img = new Image(); img.onload = () => { try { const aspectRatio = img.naturalWidth / img.naturalHeight; let drawWidth = imageRenderHeight * aspectRatio; let drawHeight = imageRenderHeight; if (drawWidth > cardWidth) { drawWidth = cardWidth; drawHeight = cardWidth / aspectRatio; } const imgX = x + (cardWidth - drawWidth) / 2; const imgY = y; ctx.drawImage(img, imgX, imgY, drawWidth, drawHeight); ctx.fillStyle = '#2d3748'; ctx.font = '26px "Indie Flower", cursive'; ctx.textAlign = 'center'; const maxWidth = cardWidth - 10; const text = cardData.text; const words = text.split(' '); let line = ''; const lineHeight = 32; let lineY = y + imageRenderHeight + 25 + lineHeight; for (let n = 0; n < words.length; n++) { const testLine = line + words[n] + ' '; const metrics = ctx.measureText(testLine); if ((metrics.width > maxWidth && n > 0) || (lineY > y + cardHeight - padding)) { if (lineY <= y + cardHeight - padding) ctx.fillText(line.trim(), x + cardWidth / 2, lineY); if (lineY + lineHeight <= y + cardHeight - padding) { line = words[n] + ' '; lineY += lineHeight; } else { line = ''; break; } } else { line = testLine; } } if (line && lineY <= y + cardHeight - padding) ctx.fillText(line.trim(), x + cardWidth / 2, lineY); resolve(); } catch (drawError) { reject(drawError); } };
        img.onerror = (err) => { console.error("Error loading image for grid:", err); ctx.fillStyle = '#4a5568'; ctx.fillRect(x, y, cardWidth, imageRenderHeight); ctx.fillStyle = '#e2e8f0'; ctx.font = '16px sans-serif'; ctx.textAlign = 'center'; ctx.fillText("Load Error", x + cardWidth / 2, y + imageRenderHeight / 2); resolve(); }; img.src = cardData.imageUrl; }));
    try { await Promise.all(promises); return canvas.toDataURL('image/png'); } catch (error) { console.error("Error generating grid image:", error); errorContainer.textContent = `Grid generation error: ${parseError(error)}`; errorContainer.removeAttribute('hidden'); return ''; }
}


// --- Dynamic Example Fetching (Uses sendMessage WITH OBJECT) ---
async function fetchAndDisplayExamples() {
    console.log("Attempting to fetch examples...");
    if (!examplesList) { console.error("Examples list element not found!"); return; }
    if (isFetchingExamples) { console.log("Already fetching examples, skipping."); return; }

    isFetchingExamples = true;
    examplesList.innerHTML = '<li class="loading-examples">Generating creative examples...</li>';
// *** UPDATED PROMPT FOR TOPICS ONLY ***
    const prompt = `Generate exactly 3 distinct, interesting, and concise example topics suitable for explanation.
Each topic should be ONLY a concept name or a 'How/What/Why' question, under 10 words.
STRICTLY DO NOT include any explanation, metaphor, or extra descriptive text after the topic/question itself.
Provide ONLY the 3 topics/questions, each on a new line.

GOOD Examples (Format ONLY):
How Crayons are made
Fall of the Roman Empire
Why AI isn't the answer to everything
How to figure out what to wear today
The VC Startup Playbook

BAD Examples (Content to AVOID):
Why is collaboration like building a bridge?
What is opportunity cost? A seesaw.
It's essential to
How does inflation work? An overflowing bathtub.`;
    // *** END EXAMPLE PROMPT ***
    
    console.log("Example generation prompt:", prompt);

    try {
        // Use sendMessage() on the chat session created for examples
        console.log("Calling exampleGenerationChat.sendMessage...");
        // exampleGenerationChat.history.length = 0; // Reset history before sending

        // *** FIX: Wrap the prompt string in an object ***
        const result = await exampleGenerationChat.sendMessage({ message: prompt });

        const response = result.text;
        const rawText = response
        console.log("Raw response text from LLM for examples:\n---\n", rawText, "\n---");
        const topics = rawText.split('\n').map(t => t.trim()).filter(t => t.length > 0).map(t => t.replace(/^[\d.\-\*]\s*/, '')).filter(t => t.length > 5).slice(0, 3);
        console.log("Parsed topics:", topics);
        examplesList.innerHTML = '';
        if (topics.length > 0) {
            topics.forEach(topic => { const li = document.createElement('li'); li.textContent = topic; li.addEventListener('click', async () => { if (!isGenerating) { userInput.value = topic; await generateExplanation(topic); } }); examplesList.appendChild(li); });
            console.log("Successfully added examples to the list.");
        } else { throw new Error(`LLM response parsing failed or returned no valid topics. Raw response: "${rawText}"`); }
    } catch (err: any) {
        console.error("!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!"); console.error("!!! Error fetching or processing examples:", err); console.error("!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!");
        examplesList.innerHTML = `<li class="error-examples">Could not load examples: ${parseError(err)}. Try entering a topic manually.</li>`;
    } finally {
         console.log("Finished fetching examples attempt.");
         isFetchingExamples = false;
    }
}


// --- Get Control Value & Slider Mappings ---
function getControlValue(selectElement: HTMLSelectElement | null, customInputElement: HTMLInputElement | null, defaultValue: string): string {
    if (!selectElement) return defaultValue; const selectedValue = selectElement.value; if (selectedValue === 'custom') { return customInputElement?.value.trim() || defaultValue; } return selectedValue || defaultValue;
}
function getMaturityDescription(value: number): string {
    const descriptions = ["G-Rated (0/10)", "Very Mild (1/10)", "Mild Themes (2/10)", "Mildly Edgy (3/10)", "Moderately Edgy (4/10)", "Edgy/Satirical (5/10)", "Suggestive (6/10)", "Mature Themes (7/10)", "Strongly Inappropriate (8/10)", "Very Explicit (9/10)", "Maximum NSFW (10/10)"]; return descriptions[value] || "Unknown";
}
function getInsanityDescription(value: number): string {
    const descriptions = ["Perfectly Normal (0/10)", "Slightly Odd (1/10)", "Quirky (2/10)", "Eccentric (3/10)", "Absurd (4/10)", "Surreal (5/10)", "Chaotic (6/10)", "Unpredictable (7/10)", "Completely Unhinged (8/10)", "Reality Breaking (9/10)", "Pure Gibberish (10/10)"]; return descriptions[value] || "Unknown";
}


// --- Main Generation Logic (UPDATED for early download controls visibility) ---
async function generateExplanation(topicToExplain: string) {
    if (isGenerating) { console.log("Generation already in progress, skipping."); return; }
    isGenerating = true; console.log(`Starting explanation generation for: "${topicToExplain}"`);

    // Disable UI elements
    userInput.disabled = true;
    customizationControls?.setAttribute('disabled', 'true');
    // --- Button remains disabled ---
    if (downloadBtn) downloadBtn.disabled = true;
    // --- Make controls VISIBLE, but keep button disabled ---
    if (downloadControls) downloadControls.removeAttribute('hidden');
    // --- Show info text ---
    if (downloadInfo) {
        downloadInfo.textContent = "Generating explanation... Download button available when finished.";
        downloadInfo.removeAttribute('hidden');
    }

    // Clear previous results state and UI
    mainGenerationChat.history.length = 0;
    modelOutput.innerHTML = '';
    slideshow.innerHTML = '';
    generatedSlidesData = [];
    errorContainer.innerHTML = '';
    errorContainer.setAttribute('hidden', 'true');
    slideshow.setAttribute('hidden', 'true');

    // --- Read Customization Values ---
    const subject = getControlValue(subjectSelect, subjectCustomInput, 'tiny creatures');
    const mood = getControlValue(moodSelect, moodCustomInput, 'neutral');
    const drawingStyle = getControlValue(drawingStyleSelect, drawingStyleCustomInput, 'simple line drawing');
    const genre = getControlValue(genreSelect, genreCustomInput, 'straightforward explanation');
    const perspective = getControlValue(perspectiveSelect, perspectiveCustomInput, 'third-person observer');
    const setting = getControlValue(settingSelect, settingCustomInput, 'a generic void');
    const maturityValue = maturitySlider ? parseInt(maturitySlider.value, 10) : 3;
    const insanityValue = insanitySlider ? parseInt(insanitySlider.value, 10) : 2;
    const maturityDescription = getMaturityDescription(maturityValue);
    const insanityDescription = getInsanityDescription(insanityValue);

    // --- Construct Dynamic Instructions ---
    // --- Construct Dynamic Instructions (MODIFIED FOR HUMOR/FINISH) ---
    const dynamicInstructions = `
Use a fun, inherently humorous story about lots of ${subject} as a metaphor to explain the topic.
These subjects should generally be depicted as ${mood}.
The explanation should be delivered from a ${perspective} perspective.
The story or metaphor should unfold within a setting described as: ${setting}.
Keep sentences extremely short, punchy, and witty.
Generate an illustration for *every single sentence* in a ${drawingStyle} style. The visuals MUST match the mood, setting, subjects, and contribute to the overall humor.
The overall tone should reflect a maturity level of ${maturityDescription}.
The narrative should feel like a ${genre}.
The explanation should have an insanity level of ${insanityDescription}.

// --- HUMOR & FINISH EMPHASIS ---
Crucially, the entire explanation and illustrations MUST be consistently humorous, clever, satirical, or amusingly absurd. Find the funny angle.
Do NOT include any separate introduction or meta-commentary. Start the metaphorical explanation immediately.
Ensure the entire topic is covered.
Instead of just stopping, CONCLUDE the explanation *itself* with a strong, genuinely funny final sentence or punchline directly related to the metaphor that cleverly ties back to the core topic. Make the ending memorable and humorous. Avoid adding a separate summary section.
Every sentence must have a corresponding image.
// --- END HUMOR & FINISH EMPHASIS ---
`;
    // --- END Construct Dynamic Instructions ---
    const messageForStream = `Topic to explain: ${topicToExplain}\n\nDetailed Instructions:\n${dynamicInstructions}`;
    console.log("Generated dynamic instructions:", dynamicInstructions);

    try {
        // Display user prompt in UI
        const userTurn = document.createElement('div');
        userTurn.innerHTML = await marked.parse(`**Explaining:** ${topicToExplain}`);
        userTurn.className = 'user-turn';
        modelOutput.append(userTurn);
        userInput.value = ''; // Clear input textarea

        // --- Call mainGenerationChat.sendMessageStream ---
        console.log("Calling mainGenerationChat.sendMessageStream...");
        const result = await mainGenerationChat.sendMessageStream({ message: messageForStream });
        console.log("Stream initiated for main generation.");

        // --- Process stream ---
        let text = '';
        let img: HTMLImageElement | null = null;
        let firstSlideAdded = false;
        for await (const chunk of result) {
            if (!chunk.candidates?.[0]?.content?.parts) { console.log("Skipping chunk with unexpected structure:", chunk); continue; }
            for (const candidate of chunk.candidates) { for (const part of candidate.content.parts ?? []) { if (part.text) { text += part.text; } else if (part.inlineData?.data) { try { const mimeType = part.inlineData.mimeType || 'image/png'; img = document.createElement('img'); img.src = `data:${mimeType};base64,${part.inlineData.data}`; } catch (e) { console.error('Image processing error:', e); img = null; } } if (text.trim() && img) { await addSlide(text.trim(), img); if (!firstSlideAdded) { slideshow.removeAttribute('hidden'); firstSlideAdded = true; } text = ''; img = null; } } }
        }
        console.log("Stream processing finished.");

        // Handle leftovers - including potential text-only final slide
         if (text.trim()) {
             // Changed the console warning slightly to acknowledge the final text might be the punchline
             console.warn("Ended with text, potentially the punchline without image:", text);
             const finalSlide = document.createElement('div');
            finalSlide.className = 'slide text-only-slide';
            const caption = document.createElement('div');
            caption.innerHTML = await marked.parse(text.trim());
            caption.style.marginTop = 'auto'; caption.style.marginBottom = 'auto';
            finalSlide.append(caption);
            slideshow.append(finalSlide);
            if (!firstSlideAdded) slideshow.removeAttribute('hidden');
        } else if (img && !text.trim()){
             console.warn("Ended with image, but no final text:", img.src.substring(0,50)+"...");
        }

    } catch (e) {
        const msg = parseError(e);
        console.error("!!! Generation Error:", e);
        errorContainer.innerHTML = `<strong>Error during generation:</strong> ${msg}`;
        errorContainer.removeAttribute('hidden');
        // --- Hide controls and info on error ---
        if (downloadControls) downloadControls.setAttribute('hidden', '');
        if (downloadInfo) downloadInfo.setAttribute('hidden', '');
    } finally {
        // Re-enable UI elements
        userInput.disabled = false;
        customizationControls?.removeAttribute('disabled');
        isGenerating = false;

        // --- Update download controls visibility/state ---
        if (generatedSlidesData.length > 0) {
            // Slides generated: Keep controls visible, enable button, hide info
            if (downloadControls) downloadControls.removeAttribute('hidden'); // Ensure visible
            if (downloadBtn) downloadBtn.disabled = false; // Enable button
            if (downloadInfo) downloadInfo.setAttribute('hidden', ''); // Hide info text
        } else {
            // No slides generated (or error occurred): Hide controls, ensure button disabled, hide info
            if (downloadControls) downloadControls.setAttribute('hidden', '');
            if (downloadBtn) downloadBtn.disabled = true; // Ensure button is disabled
            if (downloadInfo) downloadInfo.setAttribute('hidden', '');
        }
        // --- End download controls update ---

        userInput.focus();
        console.log("Generation process finished (either success or error).");
    }
}


// --- Event Listeners ---
userInput.addEventListener('keydown', async (e: KeyboardEvent) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); const message = userInput.value.trim(); if (message && !isGenerating) await generateExplanation(message); } });
function setupCustomDropdownListeners() { const selectsWithCustom = document.querySelectorAll<HTMLSelectElement>('select[data-custom-target]'); selectsWithCustom.forEach(selectElement => { const targetId = selectElement.dataset.customTarget; if (!targetId) return; const customInput = document.getElementById(targetId) as HTMLInputElement | null; if (!customInput) return; selectElement.addEventListener('change', () => { if (selectElement.value === 'custom') { customInput.removeAttribute('hidden'); customInput.focus(); } else { customInput.setAttribute('hidden', ''); customInput.value = ''; } }); if (selectElement.value === 'custom') { customInput.removeAttribute('hidden'); } else { customInput.setAttribute('hidden', ''); } }); }
function setupSliderListeners() { if (maturitySlider && maturityValueDisplay) { maturitySlider.addEventListener('input', () => { const value = parseInt(maturitySlider.value, 10); maturityValueDisplay.textContent = `Level ${value}: ${getMaturityDescription(value)}`; }); maturityValueDisplay.textContent = `Level ${maturitySlider.value}: ${getMaturityDescription(parseInt(maturitySlider.value, 10))}`; } else { console.warn("Maturity slider/display not found."); } if (insanitySlider && insanityValueDisplay) { insanitySlider.addEventListener('input', () => { const value = parseInt(insanitySlider.value, 10); insanityValueDisplay.textContent = `Level ${value}: ${getInsanityDescription(value)}`; }); insanityValueDisplay.textContent = `Level ${insanitySlider.value}: ${getInsanityDescription(parseInt(insanitySlider.value, 10))}`; } else { console.warn("Insanity slider/display not found."); } }
if (downloadBtn && gridSizeSelect) { downloadBtn.addEventListener('click', async () => { if (generatedSlidesData.length === 0 || isGenerating) return; downloadBtn.disabled = true; const originalButtonText = downloadBtn.textContent; downloadBtn.textContent = 'Generating...'; try { const gridSize = parseInt(gridSizeSelect.value, 10); const dataUrl = await generateGridImage(gridSize); if (dataUrl) { const link = document.createElement('a'); link.href = dataUrl; const timestamp = new Date().toISOString().replace(/[:.]/g, '-'); const subject = getControlValue(subjectSelect, subjectCustomInput, 'metaphor'); link.download = `explained_${gridSize}x${gridSize}_${timestamp}.png`; document.body.appendChild(link); link.click(); document.body.removeChild(link); } else { if (!errorContainer.textContent) { errorContainer.textContent = "Failed to generate grid image data."; errorContainer.removeAttribute('hidden'); } } } catch (err) { console.error("Download grid error:", err); errorContainer.textContent = `Download error: ${parseError(err)}`; errorContainer.removeAttribute('hidden'); } finally { downloadBtn.textContent = originalButtonText; if (generatedSlidesData.length > 0) downloadBtn.disabled = false; } }); } else { console.warn("Download button or grid size select not found in the DOM."); }

// --- Initial Page Load ---
function initializeApp() {
    console.log("Initializing app...");
    if(downloadControls) downloadControls.setAttribute('hidden', '');
    if(downloadInfo) downloadInfo.setAttribute('hidden', '');
    if(downloadBtn) downloadBtn.disabled = true;
    setupCustomDropdownListeners();
    setupSliderListeners();
    fetchAndDisplayExamples(); // Fetch examples *after* setting up other listeners
    console.log("App initialization complete.");
}
document.addEventListener('DOMContentLoaded', initializeApp);