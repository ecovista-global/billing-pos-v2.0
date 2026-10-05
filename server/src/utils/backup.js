const prisma = require('../db/prisma');
const path = require('path');
const fs = require('fs');

const backupDir = path.resolve(__dirname, '../../data/backups');
if (!fs.existsSync(backupDir)) {
  fs.mkdirSync(backupDir, { recursive: true });
}

function pruneOldBackups(directory, keepCount) {
  const files = fs.readdirSync(directory)
    .filter(f => f.endsWith('.db'))
    .map(f => ({
      name: f,
      path: path.join(directory, f),
      time: fs.statSync(path.join(directory, f)).mtime.getTime()
    }))
    .sort((a, b) => b.time - a.time);

  for (let i = keepCount; i < files.length; i++) {
    fs.unlinkSync(files[i].path);
  }
}

function createBackup() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = path.join(backupDir, `ecofone_backup_${timestamp}.db`);
  
  prisma.$executeRawUnsafe(`VACUUM INTO '${backupPath}'`).catch(err => console.error('Backup error:', err));
  
  // Keep only last 7 backups
  pruneOldBackups(backupDir, 7);
  

  return backupPath;
}

// Schedule daily backup at midnight
setInterval(createBackup, 24 * 60 * 60 * 1000);

module.exports = { createBackup };
