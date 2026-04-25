const fs = require('fs');
const path = require('path');

// Running from repository root
const modelsDir = path.join(process.cwd(), 'models');
if (!fs.existsSync(modelsDir)) {
    console.error('Models directory not found:', modelsDir);
    process.exit(1);
}

const files = fs.readdirSync(modelsDir);

files.forEach(file => {
    if (!file.endsWith('.js') || file === 'Institution.js') return;
    
    const filePath = path.join(modelsDir, file);
    let content = fs.readFileSync(filePath, 'utf8');
    
    const pattern = /connection\.model\((['"])(.*?)\1\s*,\s*(.*?)\)/;
    const match = content.match(pattern);
    
    if (match) {
        const modelName = match[2];
        const schemaName = match[3];
        const replacement = `connection.models.${modelName} || connection.model('${modelName}', ${schemaName})`;
        
        const newContent = content.replace(match[0], replacement);
        fs.writeFileSync(filePath, newContent);
        console.log(`Updated ${file}`);
    } else {
        console.log(`No match in ${file}`);
    }
});
