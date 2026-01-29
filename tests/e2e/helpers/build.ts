import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * Build the extension before running E2E tests
 */
export async function buildExtension(): Promise<void> {
  console.log('Building extension...');
  try {
    const { stdout, stderr } = await execAsync('yarn build');
    if (stderr && !stderr.includes('webpack')) {
      console.error('Build warnings:', stderr);
    }
    console.log('Extension built successfully');
  } catch (error) {
    console.error('Failed to build extension:', error);
    throw error;
  }
}

/**
 * Check if extension is built
 */
export function isExtensionBuilt(): boolean {
  const fs = require('fs');
  const path = require('path');
  const distPath = path.join(__dirname, '../../../dist');
  return fs.existsSync(distPath) && fs.existsSync(path.join(distPath, 'manifest.json'));
}
