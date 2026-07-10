#!/usr/bin/env node
/** @deprecated Utiliser pipeline-task.js — exécute le pipeline automatique avec preuves */
const { execSync } = require('child_process');
const args = process.argv.slice(2).join(' ');
execSync(`node scripts/pipeline-task.js ${args}`, { stdio: 'inherit', cwd: require('path').join(__dirname, '..') });
