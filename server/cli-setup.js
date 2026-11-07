import { store } from './store.js';
import { ensureAutoSetupOnBoot, checkSystemStatus } from './services/setupManager.js';

console.log('\n✦ OpenClaude Automated Setup & Environment Bootstrapper\n');
const settings = store.getSettings();
await ensureAutoSetupOnBoot(settings);
const status = await checkSystemStatus(settings);
console.log('\nSystem Summary:');
console.log(`  • Node.js:   ${status.nodeVersion}`);
console.log(`  • 9Router:   ${status.nineRouter.installed ? 'Installed' : 'Missing'} | ${status.nineRouter.running ? `Online (${status.nineRouter.dashboardUrl})` : 'Stopped'} | ${status.nineRouter.modelsCount} routes`);
console.log(`  • Ollama:    ${status.ollama.installed ? `Installed (${status.ollama.version})` : 'Not Installed'} | ${status.ollama.running ? 'Online (http://127.0.0.1:11434)' : 'Stopped'} | ${status.ollama.modelsCount} local models\n`);
process.exit(0);
