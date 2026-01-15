/**
 * Handler for proxying image fetches (bypassing CSP/CORS)
 */
import { MessageResponse } from '../../types';

/**
 * Handler for fetching images (bypasses CSP restrictions)
 */
export async function handleFetchImage(url: string): Promise<MessageResponse<{ dataUrl: string }>> {
    try {
        const response = await fetch(url);
        const blob = await response.blob();

        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => {
                resolve({
                    success: true,
                    data: { dataUrl: reader.result as string },
                });
            };
            reader.onerror = () => {
                resolve({
                    success: false,
                    error: 'Failed to convert image to data URL',
                });
            };
            reader.readAsDataURL(blob);
        });
    } catch (error) {
        console.error('Error fetching image:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to fetch image',
        };
    }
}
