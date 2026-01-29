import { test, expect } from '@playwright/test';
import { buildExtension, isExtensionBuilt } from './helpers/build';
import path from 'path';
import fs from 'fs';

/**
 * E2E Test: Extension Loading and Basic Functionality
 *
 * Critical Path: Verify extension loads without errors
 */

test.describe('Extension Loading', () => {
  test.beforeAll(async () => {
    // Ensure extension is built
    if (!isExtensionBuilt()) {
      await buildExtension();
    }
  });

  test('extension manifest exists and is valid', async () => {
    const manifestPath = path.join(__dirname, '../../dist/manifest.json');

    expect(fs.existsSync(manifestPath)).toBe(true);

    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));

    expect(manifest.manifest_version).toBe(3);
    expect(manifest.name).toBe('Notes Collector');
    expect(manifest.version).toBeDefined();
    expect(manifest.permissions).toContain('storage');
    expect(manifest.permissions).toContain('activeTab');
    expect(manifest.sidebar_action).toBeDefined();
    expect(manifest.background).toBeDefined();
    expect(manifest.content_scripts).toBeDefined();
  });

  test('all required files are built', async () => {
    const distPath = path.join(__dirname, '../../dist');

    // Check critical files exist
    const requiredFiles = [
      'manifest.json',
      'background.js',
      'content/content.js',
      'sidebar/sidebar.js',
      'sidebar/sidebar.html',
    ];

    for (const file of requiredFiles) {
      const filePath = path.join(distPath, file);
      expect(fs.existsSync(filePath), `${file} should exist`).toBe(true);
    }
  });

  test('built files have non-zero size', async () => {
    const distPath = path.join(__dirname, '../../dist');

    const criticalFiles = ['background.js', 'content/content.js', 'sidebar/sidebar.js'];

    for (const file of criticalFiles) {
      const filePath = path.join(distPath, file);
      const stats = fs.statSync(filePath);
      expect(stats.size, `${file} should have content`).toBeGreaterThan(0);
    }
  });
});
