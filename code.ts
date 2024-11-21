// Define the TypeScript interfaces for the OpenAI API response and errors
interface OpenAIResponse {
    choices: Array<{
        message: {
            content: string;
        }
    }>;
}

interface OpenAIErrorResponse {
    error: {
        message: string;
        code: string;
    };
}

// Custom function to convert image bytes to a Base64 string
function toBase64(byteArray: Uint8Array): string {
    const base64Characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
    let result = '';
    let i = 0;
    const length = byteArray.length;
    while (i < length) {
        const bin1 = byteArray[i++] & 0xFF;
        let bin2 = 0;
        let bin3 = 0;

        if (i < length) {
            bin2 = byteArray[i++] & 0xFF;
            if (i < length) {
                bin3 = byteArray[i++] & 0xFF;
            }
        }

        const enc1 = bin1 >> 2;
        const enc2 = ((bin1 & 0x03) << 4) | (bin2 >> 4);
        const enc3 = ((bin2 & 0x0F) << 2) | (bin3 >> 6);
        const enc4 = bin3 & 0x3F;

        result += base64Characters.charAt(enc1) + base64Characters.charAt(enc2);
        result += (i > length + 1 ? '=' : base64Characters.charAt(enc3));
        result += (i > length ? '=' : base64Characters.charAt(enc4));
    }

    return result;
}

async function analyzeAllFrames(detailed: boolean, selected: boolean = false, criteria: string = 'all') {
    let frames: FrameNode[] = [];
    
    if (selected) {
        const selectedNodes = figma.currentPage.selection;
        frames = selectedNodes.filter(node => node.type === 'FRAME' || node.type === 'TEXT') as FrameNode[];
        
        if (frames.length === 0) {
        figma.ui.postMessage({ type: 'error', data: 'No frames or text nodes selected. Please select frames or text elements to analyze.' });
            return;
        }
    } else {
        frames = figma.currentPage.children.filter(node => node.type === 'FRAME' || node.type === 'TEXT') as FrameNode[];
        
        if (frames.length === 0) {
        figma.ui.postMessage({ type: 'error', data: 'No frames or text nodes found on the current page. Please add frames or text elements to analyze.' });
            return;
        }
    }

    let prompt = '';
    switch (criteria) {
        case 'page-title':
            prompt = "Evaluate whether the page title accurately describes the topic or purpose of the page. Show whether it has passed or failed accessibility standards";
            break;
        case 'headings':
            prompt = "Evaluate if all text that looks and acts like a heading is correctly marked as a heading and whether heading levels convey their correct hierarchical order.Provide suggestions for improvement. Show whether it has passed or failed accessibility standards";
            break;
        case 'navigation':
            prompt = "Evaluate if a method is provided to skip repetitive navigation and go to the main content. Verify if reading and focus order is logical and intuitive.  Show whether it has passed or failed accessibility standards";
            break;
        case 'color-contrast-detailed':
            prompt = "Evaluate this design for detailed color and contrast, including text distinguishability, actionable element focus, non-text element's contrast and color contrast issues. Identify any areas where the contrast ratio does not meet accessibility standards and provide suggestions for improvement. calculate contrast ratio and Show whether it has passed or failed accessibility color contrast standards";
            break;
        case 'text':
            prompt = "Evaluate this design for text accessibility. Focus on text size, readability, and proper use of headings. Provide suggestions for improvement. Show whether it has passed or failed accessibility standards";
            break;
        case 'links':
            prompt = "Evaluate this design for link accessibility. Check if links are descriptive and easily identifiable. Provide suggestions for improvement. Show whether it has passed or failed accessibility standards";
            break;
        case 'magnification':
            prompt = "Evaluate whether the design supports zooming and magnification on any device, and if the design is optimized for all zoom states, including avoiding horizontal scrolling. Show whether it has passed or failed accessibility standards";
            break;
        case 'images-detailed':
            prompt = "Evaluate image accessibility, including complex images, decorative images, and whether text is embedded in images when it shouldn’t be. Check for appropriate alt text and descriptions for images. Provide suggestions for improvement. Show whether it has passed or failed accessibility standards";
            break;
        case 'tables':
            prompt = "Check if data tables have a caption, and if rows/columns are correctly identified. Ensure complex tables are simplified. Show whether it has passed or failed accessibility standards";
            break;
        case 'forms':
            prompt = "Evaluate if all form fields have appropriate labels, error messages, and if form elements are connected logically with labels and instructions. Show whether it has passed or failed accessibility standards";
            break;
        case 'dynamic-content':
            prompt = "Evaluate whether users are aware of dynamic content changes, and if interactions provide proper success and failure feedback. Show whether it has passed or failed accessibility standards";
            break;
        case 'custom-widgets':
            prompt = "Evaluate whether standard HTML widgets are used whenever possible, and if custom widgets are created with full keyboard support. Show whether it has passed or failed accessibility standards";
            break;
        case 'touch-devices':
            prompt = "Evaluate if the touch target size of links and buttons is large enough and spaced adequately, and if there are alternatives for custom swipe actions or gestures. Show whether it has passed or failed accessibility standards";
            break;
        default:
            prompt = "Evaluate this design in detail based on below criteria: 1. Specification Creation: Generate detailed accessibility specifications based on the OpenAI analysis, targeting key areas like color contrast, text size, other interactive elements and more. 2. Engineering Focus: Tailor specifications to guide engineers in implementing accessibility features effectively. 3. Comment Details: Include specific issues identified, recommendations, and links to relevant accessibility guidelines. Show whether it has passed or failed accessibility standards";
    }

    let processed = 0;
    for (const frame of frames) {
        figma.ui.postMessage({ type: 'progress-update', data: `Preparing to analyze ${frame.name} (${++processed}/${frames.length})...` });
        await new Promise(resolve => setTimeout(resolve, 500));
        
        figma.ui.postMessage({ type: 'progress-update', data: `Exporting frame ${frame.name} as image...` });
        await new Promise(resolve => setTimeout(resolve, 500));
        const bytes = await frame.exportAsync({ format: 'PNG', constraint: { type: 'SCALE', value: 2 } }); // Exporting at 2x scale for better detail
        const imageBase64 = toBase64(new Uint8Array(bytes));
        const apiKey = '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';
        
        figma.ui.postMessage({ type: 'display-image', imageUrl: `data:image/png;base64,${imageBase64}`, frameName: frame.name });
        figma.ui.postMessage({ type: 'progress-update', data: `Sending frame ${frame.name} to OpenAI for analysis...` });
        
        
        const messages = [{
            role: "user",
            content: [{
                type: "text",
                text: prompt
            }, {
                type: "image_url",
                image_url: {
                    url: `data:image/png;base64,${imageBase64}`
                }
            }]
        }];

        try {
            const response = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: "gpt-4o-mini",
                    messages: messages
                })
            });

            figma.ui.postMessage({ type: 'progress-update', data: `Analyzing frame ${frame.name}...` });
        await new Promise(resolve => setTimeout(resolve, 500));

            if (!response.ok) {
                const errorResponse = await response.json() as OpenAIErrorResponse;
                figma.ui.postMessage({ type: 'error', data: `Error analyzing frame ${frame.name}: ${errorResponse.error.message}` });
                continue; // Move to the next frame if there's an error
            }

            figma.ui.postMessage({ type: 'progress-update', data: `Processing response from OpenAI for ${frame.name}...` });
        await new Promise(resolve => setTimeout(resolve, 1000));
            const data = await response.json() as OpenAIResponse;
            console.log(`Results for ${frame.name}:`, JSON.stringify(data, null, 2));
            const analysisResult = data.choices[0].message.content ?? "No results available";
            figma.ui.postMessage({ type: 'show-result', frameName: frame.name, data: analysisResult });

            figma.ui.postMessage({ type: 'progress-update', data: `Posting comment for ${frame.name}...` });
        await new Promise(resolve => setTimeout(resolve, 1000));
            // Post comments to Figma using REST API
            await postCommentToFigma(frame.id, analysisResult);
            figma.ui.postMessage({ type: 'progress-update', data: `Comment posted for ${frame.name}. Preparing next frame...` });
        await new Promise(resolve => setTimeout(resolve, 1000));

        } catch (error: any) {
            figma.ui.postMessage({ type: 'error', data: `Unexpected error analyzing frame ${frame.name}: ${error.message}` });
        }
    }
    // Send a final message once all frames are processed
    figma.ui.postMessage({ type: 'progress-update', data: 'Analysis completed.' });
}

async function postCommentToFigma(frameId: string, commentText: string) {
    console.log("Figma object on call:", figma);
    const fileKey = figma.fileKey; // Fetch the file key of the current Figma file
    console.log("Attempting to post comment with file key:", fileKey);

    if (!fileKey) {
        figma.ui.postMessage({ type: 'error', data: "File key is undefined. Please check the plugin's permissions and context." });
        return; // Exit the function if file key is not found
    }

    const accessToken = 'figd_PSym2SLJSUtrNqyb9lumPYG0ZpYWmsqFQHE1m_DX'; // Use your actual Figma access token
    const commentPayload = {
        message: commentText,
        client_meta: {
            node_id: frameId,
            node_offset: {
                x: 0,
                y: 0
            }
        }
    };

    try {
        const response = await fetch(`https://api.figma.com/v1/files/${fileKey}/comments`, {
            method: 'POST',
            headers: {
                'X-Figma-Token': accessToken,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(commentPayload)
        });

        if (!response.ok) {
            const errorMessage = await response.text();
            figma.ui.postMessage({ type: 'error', data: `Failed to post comment to Figma: ${errorMessage}` });
        } else {
            figma.ui.postMessage({ type: 'comment-result', frameName: frameId, data: 'Comment successfully posted to Figma' });
        }
    } catch (error: any) {
        figma.ui.postMessage({ type: 'error', data: `Error posting comment to Figma: ${error.message}` });
    }
}

// Setup for Figma UI and message handling
figma.showUI(__html__, { width: 700, height: 700 });
figma.ui.onmessage = msg => {
    if (msg.type === 'analyze-frame' && msg.selected) {
        analyzeAllFrames(msg.detailed, true, msg.criteria);
    } else if (msg.type === 'analyze-text') {
        analyzeAllFrames(msg.detailed, false, msg.criteria);
    }
};
