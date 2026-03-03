import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const CONFIGS_DIR = path.resolve(__dirname, '../../../data/claude-configs');
const GLOBAL_CLAUDE_DIR = path.join(os.homedir(), '.claude');

/**
 * Auto-create an isolated Claude config directory for an instance.
 *
 * CLAUDE_CONFIG_DIR overrides ~/.claude/ — the settings.json inside it
 * controls API endpoint routing (env.ANTHROPIC_BASE_URL, ANTHROPIC_API_KEY).
 *
 * Layout:
 *   data/claude-configs/{instanceId}/   ← this path is set as CLAUDE_CONFIG_DIR
 *     settings.json                     ← global settings + instance overrides
 *
 * Returns the config dir path to use as CLAUDE_CONFIG_DIR.
 */
export function ensureIsolatedConfig(
  instanceId: string,
  apiBaseUrl?: string,
  apiKey?: string,
): string {
  const isolatedDir = path.join(CONFIGS_DIR, instanceId);
  const isolatedSettings = path.join(isolatedDir, 'settings.json');

  const isNew = !fs.existsSync(isolatedDir);
  if (isNew) {
    fs.mkdirSync(isolatedDir, { recursive: true });
  }

  // Read global settings as base, but replace env entirely to avoid
  // inheriting auth tokens / base URLs that conflict with this instance.
  let settings: Record<string, any> = {};
  const globalSettings = path.join(GLOBAL_CLAUDE_DIR, 'settings.json');
  if (fs.existsSync(globalSettings)) {
    try {
      settings = JSON.parse(fs.readFileSync(globalSettings, 'utf-8'));
    } catch {
      settings = {};
    }
  }

  // Clean slate for env — only use this instance's API config
  settings.env = {};
  if (apiBaseUrl) {
    settings.env.ANTHROPIC_BASE_URL = apiBaseUrl;
  }
  if (apiKey) {
    settings.env.ANTHROPIC_API_KEY = apiKey;
  }

  fs.writeFileSync(isolatedSettings, JSON.stringify(settings, null, 2));

  // For new config dirs: seed .claude.json with onboarding/trust flags
  // so Claude Code skips the first-run connectivity check to api.anthropic.com.
  const isolatedClaudeJson = path.join(isolatedDir, '.claude.json');
  if (isNew || !fs.existsSync(isolatedClaudeJson)) {
    // Try to copy from global ~/.claude/.claude.json as base
    let claudeJson: Record<string, any> = {};
    const globalClaudeJson = path.join(GLOBAL_CLAUDE_DIR, '.claude.json');
    if (fs.existsSync(globalClaudeJson)) {
      try {
        claudeJson = JSON.parse(fs.readFileSync(globalClaudeJson, 'utf-8'));
      } catch {
        claudeJson = {};
      }
    }
    // Ensure onboarding is marked complete so startup doesn't check api.anthropic.com
    claudeJson.hasCompletedOnboarding = true;
    claudeJson.lastOnboardingVersion = claudeJson.lastOnboardingVersion || '2.1.0';
    // Pre-approve the custom API key to skip the approval prompt
    if (apiKey) {
      const keySuffix = apiKey.slice(-20);
      if (!claudeJson.customApiKeyResponses) {
        claudeJson.customApiKeyResponses = { approved: [], rejected: [] };
      }
      if (!claudeJson.customApiKeyResponses.approved.includes(keySuffix)) {
        claudeJson.customApiKeyResponses.approved.push(keySuffix);
      }
    }
    fs.writeFileSync(isolatedClaudeJson, JSON.stringify(claudeJson, null, 2));
  }

  console.log(`[ConfigIsolation] Created/updated config for ${instanceId} → ${isolatedDir}`);

  return isolatedDir;
}

/**
 * Remove the isolated config directory for an instance.
 */
export function removeIsolatedConfig(instanceId: string): boolean {
  const isolatedDir = path.join(CONFIGS_DIR, instanceId);
  if (!fs.existsSync(isolatedDir)) return false;

  try {
    fs.rmSync(isolatedDir, { recursive: true, force: true });
    console.log(`[ConfigIsolation] Removed config for ${instanceId}`);
    return true;
  } catch (err) {
    console.error(`[ConfigIsolation] Failed to remove config for ${instanceId}:`, err);
    return false;
  }
}
