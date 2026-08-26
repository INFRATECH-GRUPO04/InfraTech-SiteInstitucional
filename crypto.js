const crypto = require('crypto');

function gerarCodigoToken() {
    let token_prot;
    let hex_verificacao = /^(?=.*[0-9])(?=.*[A-F])[0-9A-F]+$/;

    do {
        token_prot = crypto.randomBytes(3).toString('hex').toUpperCase();
    } while (!hex_verificacao.test(token_prot));

    return token_prot;
}

let token_final = gerarCodigoToken();


// Criar hash
// let hash = crypto
//     .createHash('sha256')
//     .update('texto')
//     .digest('hex');

// console.log(hash);
