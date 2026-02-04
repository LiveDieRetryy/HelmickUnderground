const bcrypt = require('bcryptjs');

const password = 'HUAdmin';
const hash = '$2b$10$YBE6f7VUZm9A9rC2hPArh.svz6mTstE867wd.8aCuTd4unBIQXdO2';

console.log('Testing password:', password);
console.log('Against hash:', hash);

bcrypt.compare(password, hash).then(isMatch => {
    console.log('Password matches:', isMatch);
    
    if (isMatch) {
        console.log('\n✅ CORRECT HASH - Use this in Vercel:');
        console.log(hash);
    } else {
        console.log('\n❌ Hash does not match!');
    }
}).catch(err => {
    console.error('Error:', err);
});
