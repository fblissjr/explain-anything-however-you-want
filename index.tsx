// index.tsx
/**
 * forked from "Explain Things with Lots of Tiny Cats": https://aistudio.google.com/apps/bundled/tiny_cats
 * Refactored by Mia for correctness, robustness, descriptive natural language prompts, and error handling.
 * Kept gemini-flash-exp model and improved prompt structure based on user feedback.
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
console.log('>>> SCRIPT START <<<'); // DEBUG

import {
    GoogleGenAI,
    GenerateContentResponse,
} from '@google/genai';
import { marked } from 'marked';

// --- API Key Handling ---
// Assume API_KEY is handled by the AI Studio environment runtime.
// This block is mainly for local dev checks.
const API_KEY = process.env.API_KEY;

if (!API_KEY && !(globalThis as any).studio?.host?.apiKey) { // Add check for AI Studio environment if possible
    const errorDiv = document.querySelector('#error');
    if (errorDiv) {
        errorDiv.innerHTML = '<strong>FATAL ERROR: API Key is missing. Configure API_KEY or ensure AI Studio runtime provides it.</strong>';
        errorDiv.removeAttribute('hidden');
    }
    console.error("API_KEY environment variable not set and not detected in AI Studio.");
    // Don't throw if potentially in AI studio, but warn.
    console.warn("API_KEY not found - proceeding, check AI Studio key injection if this fails.");
} else {
    console.log("API Key found or assumed provided by environment."); // DEBUG
}
// --- END API Key Handling ---


// Instantiate - uses API_KEY which might be undefined if AI Studio handles it later/differently.
const ai = new GoogleGenAI({apiKey: API_KEY});

// --- Model/Chat Setup ---
// Dedicated instance for text-only example generation.
const exampleGenerationChat = ai.chats.create({
  model: 'gemini-2.0-flash-exp',
  config: {
    responseModalities: ['TEXT'],
    temperature: 1.4,
    topP: 0.95,
  },
  history: [],
});

// Main instance for generating explanations with images.
const mainGenerationChat = ai.chats.create({
  model: 'gemini-2.0-flash-exp', // Sticking with Flash as requested
  config: {
    responseModalities: ['TEXT', 'IMAGE'],
    temperature: 1.4,
    topP: 0.95,
  },
   history: [],
});
// --- END Model/Chat Setup ---

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
const generateBtn = document.querySelector('#generate-btn') as HTMLButtonElement;

// --- State ---
let generatedSlidesData: { text: string, imageUrl: string }[] = [];
let isGenerating = false;
let isFetchingExamples = false;


// --- Helper Functions ---

/** Creates and appends a slide element. */
async function addSlide(text: string, imageElement: HTMLImageElement): Promise<void> {
    const slide = document.createElement('div'); slide.className = 'slide';
    const clonedImage = imageElement.cloneNode(true) as HTMLImageElement;
    const caption = document.createElement('div');
    try { caption.innerHTML = await marked.parse(text); } catch (e: unknown) { console.error("Markdown parse error:", parseError(e)); caption.textContent = `(Parse Error) ${text.substring(0, 100)}...`; }
    slide.append(clonedImage); slide.append(caption); slideshow.append(slide);
    generatedSlidesData.push({ text: text, imageUrl: imageElement.src });
}

/** Parses various error types into a user-readable string. */
function parseError(error: unknown): string { console.error("Raw error in parseError:", error); if (error instanceof Error) { return error.message; } if (typeof error === 'string') { try { const parsed = JSON.parse(error); return parsed.message || `Unknown JSON error: ${error}`; } catch { /* Ignore simple strings unless JSON-like */ } if (!error.startsWith('{')) return error; } try { return `Unknown error: ${JSON.stringify(error)}`; } catch { return 'Unknown/unserializable error.'; } }


/** Generates a grid image PNG from generated slide data. */
async function generateGridImage(gridSize: number): Promise<string> { if (generatedSlidesData.length === 0) { console.warn("generateGridImage: No slide data."); return ''; } const slidePadding = 30; const imageRenderHeight = 350; const estimatedTextHeight = 120; const cardWidth = 400 - (slidePadding * 2); const cardHeight = imageRenderHeight + estimatedTextHeight + 25; const gridPadding = 20; const cols = gridSize; const rows = Math.ceil(generatedSlidesData.length / cols); const canvasWidth = cols * (cardWidth + gridPadding) + gridPadding; const canvasHeight = rows * (cardHeight + gridPadding) + gridPadding; const canvas = document.createElement('canvas'); canvas.width = canvasWidth; canvas.height = canvasHeight; const ctx = canvas.getContext('2d'); if (!ctx) { console.error("Canvas context failed."); return ''; } ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, canvasWidth, canvasHeight); ctx.translate(gridPadding, gridPadding); const drawingPromises = generatedSlidesData.map((cardData, i) => new Promise<void>((resolve, reject) => { const row = Math.floor(i / cols); const col = i % cols; const cardX = col * (cardWidth + gridPadding); const cardY = row * (cardHeight + gridPadding); const img = new Image(); img.crossOrigin = 'anonymous'; img.onload = () => { try { const aspectRatio = img.naturalWidth / img.naturalHeight; let drawWidth = imageRenderHeight * aspectRatio; let drawHeight = imageRenderHeight; if (drawWidth > cardWidth) { drawWidth = cardWidth; drawHeight = cardWidth / aspectRatio; } const imgDrawX = cardX + (cardWidth - drawWidth) / 2; const imgDrawY = cardY; ctx.drawImage(img, imgDrawX, imgDrawY, drawWidth, drawHeight); ctx.fillStyle = '#2d3748'; ctx.font = '26px "Indie Flower", cursive'; ctx.textAlign = 'center'; const textMaxWidth = cardWidth - 10; const textStartY = cardY + imageRenderHeight + 25 + 32; const words = cardData.text.split(' '); let line = ''; const lineHeight = 32; let currentY = textStartY; for (let n = 0; n < words.length; n++) { const testLine = line + words[n] + ' '; const metrics = ctx.measureText(testLine); if ((metrics.width > textMaxWidth && n > 0) || (currentY > cardY + cardHeight - gridPadding)) { if (currentY <= cardY + cardHeight - gridPadding) { ctx.fillText(line.trim(), cardX + cardWidth / 2, currentY); } if (currentY + lineHeight <= cardY + cardHeight - gridPadding) { line = words[n] + ' '; currentY += lineHeight; } else { line = ''; break; } } else { line = testLine; } } if (line.trim() && currentY <= cardY + cardHeight - gridPadding) { ctx.fillText(line.trim(), cardX + cardWidth / 2, currentY); } resolve(); } catch (drawError: unknown) { console.error("Canvas draw error:", parseError(drawError)); reject(drawError); } }; img.onerror = (err) => { try { console.error("Image load error for grid:", err, cardData.imageUrl.substring(0,100)); ctx.fillStyle = '#4a5568'; ctx.fillRect(cardX, cardY+imageRenderHeight/4, cardWidth, imageRenderHeight/2); ctx.fillStyle = '#e2e8f0'; ctx.font = '16px sans-serif'; ctx.textAlign = 'center'; ctx.fillText("Image Load Error", cardX+cardWidth/2, cardY+imageRenderHeight/2); resolve(); } catch (phErr: unknown) { reject(phErr); } }; img.src = cardData.imageUrl; })); try { await Promise.all(drawingPromises); return canvas.toDataURL('image/png'); } catch (error: unknown) { const errorMsg = parseError(error); console.error("Grid gen error:", errorMsg); errorContainer.textContent = `Grid error: ${errorMsg}`; errorContainer.removeAttribute('hidden'); return ''; } }


/** Fetches and displays example topics. */
async function fetchAndDisplayExamples() {
    console.log(">>> fetchAndDisplayExamples CALLED <<<"); // DEBUG
    if (!examplesList) { console.error("Examples list element not found!"); return; }
    if (isFetchingExamples) { console.log("Already fetching examples."); return; }
    isFetchingExamples = true; examplesList.innerHTML = '<li class="loading-examples">Generating examples...</li>';
    const prompt = `Generate exactly 3 distinct, interesting, and concise example topics suitable for explanation.\nEach topic MUST be ONLY a concept name or a 'How/What/Why' question, under 10 words.\nFormat: Return ONLY the 3 topics/questions, each on a new line.\nABSOLUTELY DO NOT include: Explanations, metaphors, descriptions, intro/outro phrases, numbering, or bullets.`;
    console.log("Example prompt:", prompt); // DEBUG
    try {
        console.log("Calling exampleGenerationChat.sendMessage..."); // DEBUG
        // Corrected based on SDK structure & runtime errors: Use result.text directly
        const result = await exampleGenerationChat.sendMessage({ message: prompt });
        const responseText = result?.text; // Access text via getter

        if (responseText === undefined || responseText === null) {
             console.error("Raw response causing text issue:", JSON.stringify(result, null, 2)); // DEBUG
             throw new Error("LLM response object exists, but the '.text' accessor returned undefined/null.");
        }
        console.log("Raw text for examples:\n---\n", responseText, "\n---"); // DEBUG
        const topics = responseText.split('\n').map(t => t.trim()).filter(t => t.length > 0 && t.length < 80).map(t => t.replace(/^[\d.\-\*\s]+/, '')).filter(t => t.length > 3).slice(0, 3);
        console.log("Parsed topics:", topics); // DEBUG
        examplesList.innerHTML = '';
        if (topics.length > 0) {
            topics.forEach(topic => { const li = document.createElement('li'); li.textContent = topic; li.addEventListener('click', async () => { if (!isGenerating) { console.log(`Example clicked: "${topic}"`); userInput.value = topic; await generateExplanation(topic); } }); examplesList.appendChild(li); });
            console.log("Successfully added examples."); // DEBUG
        } else { throw new Error(`LLM response parsing failed. Raw text: "${responseText}"`); }
    } catch (err: unknown) { const errorMsg = parseError(err); console.error("!!! Example fetch/process error:", errorMsg); if (err instanceof Error) console.error("Raw Error:", err); examplesList.innerHTML = `<li class="error-examples">Error loading examples: ${errorMsg}. Manual entry needed.</li>`;
    } finally { console.log("Example fetch attempt finished."); isFetchingExamples = false; }
}

// --- Get Control Value & Slider Mappings ---
function getControlValue(sel: HTMLSelectElement | null, custom: HTMLInputElement | null, def: string): string { if (!sel) return def; const v = sel.value; return (v === 'custom') ? (custom?.value?.trim() || def) : (v?.trim() || def); }
/**
 * Maps maturity slider value (0-10) to a descriptive string indicating content appropriateness.
 * Provides clearer guidance for the LLM on expected themes and intensity.
 * @param value - The numeric slider value (0-10).
 * @returns A descriptive string for the maturity level.
 */
function getMaturityDescription(value: number): string {
    // Array index corresponds to slider value (0-10). Descriptions aim for clarity and LLM guidance.
    const descriptions = [
        /* 0 */ "G-Rated (0/10)",           // Equivalent to G
        /* 1 */ "Subtle Themes (1/10)",        // Very mild suggestions, hints of conflict
        /* 2 */ "Mild (2/10)",          // Mild peril, non-graphic action
        /* 3 */ "Mild but Suggestive (3/10)",         // Equivalent to PG boundary
        /* 4 */ "PG-13-Rated (4/10)", // PG-13 territory, more complex themes
        /* 5 */ "Adult Themes and Language (5/10)",   // Clearer jump, could include non-explicit adult situations
        /* 6 */ "R-Rated (6/10)",    // Standard R-rated territory
        /* 7 */ "Strongly Mature (7/10)", // More intense R, potentially disturbing
        /* 8 */ "Explicit Content (8/10)",     // Clearly adult, potentially offensive elements
        /* 9 */ "Highly Explicit (9/10)",   // Pushing boundaries, strong taboos possible
        /* 10 */ "Adults Only Content (10/10)"             // Equivalent to NC-17 or beyond
    ];
    // Range check prevents accessing outside array bounds, returns 'Unknown' if value is invalid.
    return (value >= 0 && value < descriptions.length) ? descriptions[value] : "Unknown Maturity";
}

/**
 * Maps insanity slider value (0-10) to a descriptive string indicating narrative coherence and logical consistency.
 * Provides clearer guidance for the LLM on the desired level of absurdity or surrealism.
 * @param value - The numeric slider value (0-10).
 * @returns A descriptive string for the insanity level.
 */
function getInsanityDescription(value: number): string {
    // Array index corresponds to slider value (0-10). Descriptions focus on narrative logic and adherence to reality.
    const descriptions = [
        /* 0 */ "Logically Sound / Normal (0/10)",                   // Straightforward, conventional logic
        /* 1 */ "Minor Quirks / Gentle Weirdness (1/10)",            // Slight deviations from the norm, charmingly odd
        /* 2 */ "Playfully Peculiar / Whimsical (2/10)",             // Noticeably odd but generally harmless/fun
        /* 3 */ "Noticeably Strange / Offbeat Logic (3/10)",         // Requires some suspension of disbelief
        /* 4 */ "Clearly Absurd / Nonsensical Elements (4/10)",      // Incorporates blatant absurdity
        /* 5 */ "Dreamlike / Surreal & Metaphorical (5/10)",        // Logic follows dream patterns, non-literal
        /* 6 */ "Chaotic & Disordered Narrative (6/10)",            // Events lack clear cause/effect, high entropy
        /* 7 */ "Highly Unpredictable / Random Events (7/10)",      // Focus on surprising, illogical shifts
        /* 8 */ "Completely Unhinged / Breaks Rules (8/10)",         // Narrative structure or reality frequently breaks
        /* 9 */ "Defies Logic / Reality Bending (9/10)",             // Fundamental laws of reality are ignored
        /* 10 */ "Total Incoherence (10/10)"            // Pure randomness, lack of discernible meaning
    ];
    // Range check prevents accessing outside array bounds, returns 'Unknown' if value is invalid.
    return (value >= 0 && value < descriptions.length) ? descriptions[value] : "Unknown Insanity";
}

/** Main function to generate explanation using refined natural language prompt. */
async function generateExplanation(topicToExplain: string) {
    if (isGenerating) { console.warn("Generation ongoing, skipping."); return; }
    isGenerating = true; console.log(`Starting explanation for: "${topicToExplain}"`);

    // --- UI State: Disable ---
    userInput.disabled = true; if (generateBtn) generateBtn.disabled = true; customizationControls?.setAttribute('disabled', 'true'); if (downloadBtn) downloadBtn.disabled = true; if (downloadControls) downloadControls.removeAttribute('hidden'); if (downloadInfo) { downloadInfo.textContent = "Generating explanation..."; downloadInfo.removeAttribute('hidden'); }

    // --- Clear Previous Results ---
    modelOutput.innerHTML = ''; slideshow.innerHTML = ''; generatedSlidesData = []; errorContainer.innerHTML = ''; errorContainer.setAttribute('hidden', 'true'); slideshow.setAttribute('hidden', 'true');

    // --- Read Controls ---
    const subject = getControlValue(subjectSelect, subjectCustomInput, 'tiny cats'); const mood = getControlValue(moodSelect, moodCustomInput, 'adorably cute and innocent'); const drawingStyle = getControlValue(drawingStyleSelect, drawingStyleCustomInput, 'minimalist black ink line drawing'); const genre = getControlValue(genreSelect, genreCustomInput, 'simple metaphorical story'); const perspective = getControlValue(perspectiveSelect, perspectiveCustomInput, 'neutral third-person observer'); const setting = getControlValue(settingSelect, settingCustomInput, 'a busy family kitchen'); const maturityValue = maturitySlider ? parseInt(maturitySlider.value, 10) : 3; const insanityValue = insanitySlider ? parseInt(insanitySlider.value, 10) : 2; const maturityDescription = getMaturityDescription(maturityValue); const insanityDescription = getInsanityDescription(insanityValue);

    // --- REFINED Prompt Construction v3 (Focus: Completeness, Style, Wit) ---
    const instructionMessage = `
Explain the topic thoroughly and completely: "${topicToExplain}"

Use this specific metaphor:
- SUBJECT: A story about lots of **${subject}**.
- MOOD: These subjects MUST be consistently depicted as **${mood}**.
- SETTING: The story occurs entirely within this setting: **${setting}**.

Output Requirements (Follow ALL strictly):
- NARRATIVE: Tell the story from a **${perspective}** perspective, matching the **${genre}** genre. Ensure the metaphorical story is **detailed enough to fully cover the core concepts** of "${topicToExplain}". Do not oversimplify or stop too early.
- **VISUAL STYLE (MANDATORY & CONSISTENT):**
    - EVERY illustration MUST strictly adhere to the style: **"${drawingStyle}"**.
    - **NO other styles** (like photos, 3D renders) are permitted AT ANY POINT. Maintain consistency.
    - Visuals must directly reflect the specific sentence content, subject, mood, and setting.
- TONE: Maintain the tone defined by maturity "${maturityDescription}" and insanity "${insanityDescription}". Keep sentence text **concise but witty/engaging** where appropriate for the genre.
- **STRUCTURE (MANDATORY SEQUENCE):**
    - Output **ONLY** in this strict sequence: [1 short, witty/informative sentence text] THEN [1 corresponding IMAGE DATA chunk matching the specified '${drawingStyle}']. 
    - Progressively build toward a fantastic conclusion / punchline.
    - Ensure alignment with the SUBJECT, MOOD, SETTING, NARRATIVE, STYLE, and TONE.
    - **REPEAT** this exact Sentence -> Image sequence multiple times until the explanation is complete. Aim for a reasonably detailed explanation (more than just 3-4 pairs), gradually building up towaard a finale.
    - **NO PREAMBLE/COMMENTARY:** Start IMMEDIATELY with the first sentence.
    - **NO IMAGE DESCRIPTIONS:** Output ONLY raw image data chunks, never text describing an image.
- **CONCLUSION (FINAL PART):** End the ENTIRE response with **ONLY** a final single-sentenced text and image pair. This sentence MUST be a fantastic ending to the built up priors, tying a knot in the explanation to the topic in a **funny, witty, clever, and humorous way** that neatly concludes an explanation to the user's topic: ${topicToExplain}.

Begin Explanation Now:
`;
    // --- END REFINED Prompt Construction v3 ---

    const messageForStream = instructionMessage;
    console.log("Generated message for stream (v3):", messageForStream); // DEBUG

    try {
        const userTurn = document.createElement('div'); userTurn.innerHTML = await marked.parse(`**Explaining:** ${topicToExplain}`); userTurn.className = 'user-turn'; modelOutput.append(userTurn); userInput.value = '';
        console.log("Calling mainGenerationChat.sendMessageStream..."); // DEBUG
        const result = await mainGenerationChat.sendMessageStream({ message: messageForStream }) as AsyncIterable<GenerateContentResponse>;
        console.log("Stream initiated."); // DEBUG

        // --- Process stream (Robust accumulator) ---
        let accumulatedText = ''; let firstSlideAdded = false;
        console.log("Starting robust stream processing..."); // DEBUG
        for await (const chunk of result) {
             // Corrected path from last fix
            const parts = chunk?.candidates?.[0]?.content?.parts;
            if (!parts || parts.length === 0) { continue; }
            for (const part of parts) {
                if (part.text) { accumulatedText += part.text; }
                else if (part.inlineData?.data) {
                     console.log(`Image data received. Accumulated text: "${accumulatedText.trim().substring(0, 50)}..."`); // DEBUG
                     const textForSlide = accumulatedText.trim(); accumulatedText = '';
                     if (textForSlide) {
                        try {
                            const imgElement = document.createElement('img'); const safeMimeType = (part.inlineData.mimeType && part.inlineData.mimeType.startsWith('image/')) ? part.inlineData.mimeType : 'image/png'; imgElement.src = `data:${safeMimeType};base64,${part.inlineData.data}`;
                            // Optional: await imgElement.decode().catch(decodeErr => console.error("Img decode error:", parseError(decodeErr)));
                            await addSlide(textForSlide, imgElement);
                            if (!firstSlideAdded) { slideshow.removeAttribute('hidden'); firstSlideAdded = true; }
                        } catch (e: unknown) { console.error(`Slide creation error: ${parseError(e)}`, e); }
                    } else { console.warn("Image received with no preceding text.", `MIME Type: ${part.inlineData.mimeType}`); }
                }
            }
        } console.log("Stream processing finished."); // DEBUG

        // --- Handle Final Text ---
        const finalText = accumulatedText.trim();
        if (finalText) { console.log("Handling final text-only slide:", finalText); const finalSlide = document.createElement('div'); finalSlide.className = 'slide text-only-slide'; const caption = document.createElement('div'); try { caption.innerHTML = await marked.parse(finalText); } catch(e: unknown) { caption.textContent = `(Parse Error) ${finalText.substring(0,150)}...`; console.error(`Final text parse error: ${parseError(e)}`, e) } caption.style.marginTop = 'auto'; caption.style.marginBottom = 'auto'; finalSlide.append(caption); slideshow.append(finalSlide); if (!firstSlideAdded) { slideshow.removeAttribute('hidden'); } }

    } catch (e: unknown) { const msg = parseError(e); console.error("!!! Generation Error:", msg, e); errorContainer.innerHTML = `<strong>Error:</strong> ${msg}`; errorContainer.removeAttribute('hidden'); if (downloadControls) downloadControls.setAttribute('hidden',''); if (downloadInfo) downloadInfo.setAttribute('hidden','');
    } finally {
        // --- UI State: Re-enable ---
        // isGenerating = false; userInput.disabled = false; if (generateBtn) generateBtn.disabled = false; customizationControls?.removeAttribute('disabled'); userInput.focus();
        if (generatedSlidesData.length > 0) { if (downloadControls) downloadControls.removeAttribute('hidden'); if (downloadBtn) downloadBtn.disabled = false; if (downloadInfo) downloadInfo.setAttribute('hidden', ''); } else { if (downloadControls) downloadControls.setAttribute('hidden', ''); if (downloadBtn) downloadBtn.disabled = true; if (downloadInfo) downloadInfo.setAttribute('hidden', ''); }
        console.log("Generation finished. UI re-enabled."); // DEBUG
    }
}


// --- Event Listeners ---
// Enter key listener (with debug logs)
if (userInput) { console.log('Attaching keydown listener.'); userInput.addEventListener('keydown', async (e: KeyboardEvent) => { console.log(`>>> Keydown: key=${e.key}, shift=${e.shiftKey}`); if (e.key === 'Enter' && !e.shiftKey) { console.log('Enter detected.'); e.preventDefault(); const message = userInput.value.trim(); console.log(`Msg: "${message}", isGen: ${isGenerating}`); if (message && !isGenerating) { console.log('Calling generateExplanation...'); await generateExplanation(message); } else { console.log('Enter conditions NOT met.'); } } }); } else { console.error("INPUT ELEMENT NULL!"); }
// Setup dropdowns and sliders
function setupCustomDropdownListeners() { const selectsWithCustom = document.querySelectorAll<HTMLSelectElement>('select[data-custom-target]'); selectsWithCustom.forEach(selectElement => { const targetId = selectElement.dataset.customTarget; if (!targetId) return; const customInput = document.getElementById(targetId) as HTMLInputElement | null; if (!customInput) { console.warn(`Custom input target '${targetId}' not found.`); return; } const syncVisibility = () => { if (selectElement.value === 'custom') customInput.removeAttribute('hidden'); else customInput.setAttribute('hidden', ''); }; selectElement.addEventListener('change', syncVisibility); syncVisibility(); }); }
function setupSliderListeners() { function setup(slider: HTMLInputElement | null, display: HTMLSpanElement | null, getDesc: (v: number) => string, name: string) { if (slider && display) { const update = () => { const v = parseInt(slider.value, 10); display.textContent = `Level ${v}: ${getDesc(v)}`; }; slider.addEventListener('input', update); update(); } else console.warn(`${name} slider/display not found.`); } setup(maturitySlider, maturityValueDisplay, getMaturityDescription, "Maturity"); setup(insanitySlider, insanityValueDisplay, getInsanityDescription, "Insanity"); }
// Download button listener
if (downloadBtn && gridSizeSelect && errorContainer) { console.log("Attaching download listener."); downloadBtn.addEventListener('click', async () => { if (generatedSlidesData.length === 0 || isGenerating) return; downloadBtn.disabled = true; downloadBtn.textContent = 'Generating...'; errorContainer.setAttribute('hidden', ''); try { const size = parseInt(gridSizeSelect.value, 10); const url = await generateGridImage(size); if (url) { const link = document.createElement('a'); link.href = url; const timestamp = new Date().toISOString().replace(/[:.]/g, '-'); const topic = userInput.value.substring(0, 20).replace(/\W+/g,'_')||'explanation'; link.download = `${topic}_${size}xN_${timestamp}.png`; document.body.appendChild(link); link.click(); document.body.removeChild(link); } else throw new Error("Grid gen returned no data."); } catch (err: unknown) { const errorMsg = parseError(err); console.error("Download error:", errorMsg, err); errorContainer.textContent = `Download error: ${errorMsg}`; errorContainer.removeAttribute('hidden'); } finally { downloadBtn.textContent = "Download Grid"; if (generatedSlidesData.length > 0 && !isGenerating) downloadBtn.disabled = false; } }); } else { console.warn("Download elements missing."); }


// --- Initial Page Load ---
/** Initializes the application */
function initializeApp() {
    console.log('>>> initializeApp CALLED <<<'); // DEBUG
    if(downloadControls) downloadControls.setAttribute('hidden',''); if(downloadInfo) downloadInfo.setAttribute('hidden',''); if(downloadBtn) downloadBtn.disabled = true;
    console.log('Initial UI state set.'); // DEBUG
    setupCustomDropdownListeners(); console.log('Dropdown listeners done.'); // DEBUG
    setupSliderListeners(); console.log('Slider listeners done.'); // DEBUG
    // Add Button Listener
    if (generateBtn && userInput) { console.log('Adding button listener...'); generateBtn.addEventListener('click', async () => { console.log('Explain btn clicked.'); const msg = userInput.value.trim(); if (msg && !isGenerating) {await generateExplanation(msg);} else {console.log(`Btn click ignored: msg='${msg}', isGen=${isGenerating}`);} }); } else { console.warn("Generate btn/input missing."); }
    console.log('Calling fetchAndDisplayExamples...'); // DEBUG
    fetchAndDisplayExamples(); // Start fetching examples
    console.log('App initialization complete.'); // DEBUG
    // if(userInput) userInput.focus(); else console.error("User input not found.");
}

// Attach init to DOMContentLoaded
document.addEventListener('DOMContentLoaded', initializeApp);
console.log('DOMContentLoaded listener attached.'); // DEBUG

console.log('>>> SCRIPT END <<<'); // DEBUG