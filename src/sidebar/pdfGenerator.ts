/**
 * Logic for generating PDF documents from captured items
 */
import { CapturedItem } from '../types';

// Types for pdfMake (internal to this module for simplicity)
interface PdfMake {
    createPdf: (docDefinition: any) => {
        download: (filename: string) => void;
        open: () => void;
        print: () => void;
    };
}

declare const pdfMake: PdfMake;

/**
 * Generates and downloads a PDF of the captured items
 */
export async function generatePdf(items: CapturedItem[]) {
    if (items.length === 0) return;

    // Determine the title: use the most recent item's source URL if available, or a default
    let title = 'Captured Notes';
    const sortedItems = [...items].sort((a, b) => b.timestamp - a.timestamp);

    for (const item of sortedItems) {
        const sourceUrl = (item.metadata as any).sourceUrl || (item.metadata as any).href || (item.metadata as any).originalSrc;
        if (sourceUrl) {
            try {
                title = new URL(sourceUrl).hostname;
                break;
            } catch {
                title = sourceUrl;
                break;
            }
        }
    }

    const docDefinition = createDocDefinition(items, title);
    pdfMake.createPdf(docDefinition).download('captured-notes.pdf');
}

/**
 * Creates the document definition for pdfMake
 */
function createDocDefinition(items: CapturedItem[], title: string): any {
    const content: any[] = [];

    // Title
    content.push({ text: title, style: 'title' });
    content.push({
        text: `Generated on ${new Date().toLocaleString()}`,
        style: 'subtitle',
        margin: [0, 0, 0, 20],
    });

    // Sort items by order
    const sortedItems = [...items].sort((a, b) => a.order - b.order);

    // Add each item
    sortedItems.forEach((item) => {
        // No labels or numbering as per user request

        if (item.type === 'link' && 'href' in item.metadata) {
            content.push({
                text: item.metadata.text || item.metadata.href,
                link: item.metadata.href,
                style: 'link',
                margin: [10, 15, 0, 2],
            });
            if (item.metadata.text && item.metadata.text !== item.metadata.href) {
                content.push({ text: item.metadata.href, style: 'url', margin: [10, 0, 0, 0] });
            }
        } else if (item.type === 'image' && 'alt' in item.metadata && 'originalSrc' in item.metadata) {
            if (item.content?.startsWith('data:image/')) {
                try {
                    content.push({ image: item.content, width: 400, margin: [10, 15, 0, 5] });
                    if (item.metadata.alt) {
                        content.push({ text: item.metadata.alt, style: 'imageCaption', margin: [10, 5, 0, 2] });
                    }
                    content.push({ text: item.metadata.originalSrc, style: 'url', margin: [10, 0, 0, 0] });
                } catch (e) {
                    content.push({ text: `[Image Error]`, style: 'error', margin: [10, 0, 0, 2] });
                }
            }
        } else if (item.type === 'text' && 'text' in item.metadata && 'sourceUrl' in item.metadata) {
            content.push({ text: item.metadata.text, style: 'capturedText', margin: [10, 15, 0, 5] });
            content.push({ text: `Source: ${item.metadata.sourceUrl}`, style: 'url', margin: [10, 0, 0, 0] });
        } else if (item.type === 'screenshot' && 'dimensions' in item.metadata) {
            if (item.content?.startsWith('data:image/')) {
                try {
                    content.push({ image: item.content, width: 400, margin: [10, 15, 0, 5] });
                    if (item.metadata.alt) {
                        content.push({ text: item.metadata.alt, style: 'imageCaption', margin: [10, 5, 0, 2] });
                    }
                    content.push({ text: item.metadata.sourceUrl, style: 'url', margin: [10, 0, 0, 0] });
                } catch (e) {
                    content.push({ text: `[Screenshot Error]`, style: 'error', margin: [10, 0, 0, 2] });
                }
            }
        }
    });

    return {
        content,
        styles: {
            title: { fontSize: 22, bold: true, margin: [0, 0, 0, 5] },
            subtitle: { fontSize: 11, color: '#666666', italics: true },
            itemHeader: { fontSize: 14, bold: true, color: '#4a90e2', border: [0, 0, 0, 1] },
            link: { fontSize: 12, color: '#0000ff', decoration: 'underline' },
            url: { fontSize: 9, color: '#666666' },
            capturedText: { fontSize: 11, italics: true, background: '#f5f5f5', margin: [10, 5, 10, 5] },
            imageCaption: { fontSize: 10, italics: true, color: '#444444' },
            error: { fontSize: 10, color: 'red' },
        },
        defaultStyle: { font: 'Roboto' },
    };
}
