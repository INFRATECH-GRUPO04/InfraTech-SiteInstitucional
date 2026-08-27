var crypto = require('crypto');

function gerarCodigoToken() {
    let token_prot;
    const hex_verificacao = /^(?=.*[0-9])(?=.*[A-F])[0-9A-F]+$/;

    do {
        token_prot = crypto.randomBytes(3).toString('hex').toUpperCase();
    } while (!hex_verificacao.test(token_prot));

}

var token_final = gerarCodigoToken();
console.log(`Token gerado: ${token_final}`);


// Criar hash
// let hash = crypto
//     .createHash('sha256')
//     .update('texto')
//     .digest('hex');

// console.log(hash);
