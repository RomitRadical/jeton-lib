# Jeton Lib 2

**Extension of bitcore-lib-cash for advanced Bitcoin Cash transaction types**

## Purpose

Bitcoin Cash has script functionality, such as OP_CHECKDATASIG which is unique among Bitcoin forks. This functionality allows Bitcoin Cash users to particpate in on-chain, non-custodial escrow transactions (and more). Jeton Lib extends the popular [bitcore-lib-cash](https://github.com/bitpay/bitcore/tree/master/packages/bitcore-lib-cash) library to allow for easy creation of transactions which leverage the powerful capabilities of Bitcoin Cash.

## Get Started

```sh
npm install jeton-lib2
npm install bitbox-sdk
```

Adding Jeton Lib to your app's `package.json`:

```json
"dependencies": {
    "bitcore-lib-cash": "^8.8.4",
    "bitbox-sdk": "^8.11.2"
    ...
}
```

## Examples

Complete examples are located in the [/examples](https://github.com/jeton-tech/jeton-lib/tree/master/examples) directory.

### Include jeton-lib wherever you use bitcore-lib-cash

```javascript
const jeton = require("jeton-lib");
var BITBOX = require("bitbox-sdk").BITBOX;
var bitbox = new BITBOX({ restURL: `https://rest.bitcoin.com/v2/` });
const PrivateKey = jeton.PrivateKey;
const Signature = jeton.Signature;
const OutputScript = jeton.escrow.OutputScript;
const Transaction = jeton.Transaction;
```

### Generate an escrow scriptPubKey

```javascript
// Create keypairs for 2 traders and an oracle
// Seller keypairs
var sellerPrivKey = new PrivateKey(
  "220d0af479da6c89f75846209149679c6f56d7eb7f5179c1ecf4fbdf15572e38"
);
var sellerPubKey = sellerPrivKey.toPublicKey();
var sellerAddress = sellerPubKey.toAddress();

//Buyer keypairs
var buyerPrivKey = new PrivateKey(
  "aa1c53d47dec47bb8f3d2ea64c06da68e5688c864e5c7a94323cc1eb32eb868f"
);
var buyerPubKey = buyerPrivKey.toPublicKey();
var buyerAddress = buyerPubKey.toAddress();

//Oracle keypairs
var oraclePrivKey = new PrivateKey(
  "a3eeaaf3e456fb5357d672ff7acd178a57a2b1e9c9c5031a0100594ec2d4f768"
);
var oraclePubKey = oraclePrivKey.toPublicKey();
var oracleAddress = oraclePubKey.toAddress();

// Create the output script
var outputScriptData = {
  conditions: [
    {
      // Trade is successful
      message: "1",
      oraclePubKey: sellerPubKey,
      spenderAddress: buyerAddress
    },
    {
      // Buyer is awarded key
      message: "2",
      oraclePubKey: oraclePubKey,
      spenderAddress: buyerAddress
    },
    {
      // Trade Cancelled
      message: "3",
      oraclePubKey: buyerPubKey,
      spenderAddress: sellerAddress
    },
    {
      // Seller is awarded key
      message: "4",
      oraclePubKey: oraclePubKey,
      spenderAddress: sellerAddress
    }
  ]
};

outScript = new OutputScript(outputScriptData);
// p2sh escrow address to be funded
var escrowAddress = outScript.toAddress();
```

### Create a transaction with a P2SH output from escrow script

```javascript
async function fundEscrow() {
  var result = await bitbox.Address.utxo(sellerAddress.toString());
  var res = result.utxos[0];
  // Create example UTXO for seller which will be used to fund the escrow
  var utxo = new Transaction.UnspentOutput({
    txid: res.txid,
    vout: res.vout,
    satoshis: res.satoshis,
    scriptPubKey: result.scriptPubKey
  });

  // Create a transaction using the seller's private key to fund the escrow
  var fundEscrowTx = new Transaction()
    .from(utxo) // Feed information about what unspent outputs one can use
    .to(escrowAddress, 10000)
    .sign(sellerPrivKey);
  var txid = await bitbox.RawTransactions.sendRawTransaction(
    fundEscrowTx.toString()
  );
}
```

### Spend escrow UTXO

```javascript
async function spendEscrow() {
  var oraclePriv = sellerPrivKey;
  var spenderPriv = buyerPrivKey;
  var message = outputScriptData.conditions[0].message;

  //Spend Escrow
  var result = await bitbox.Address.utxo(escrowAddress.toString());
  var res = result.utxos[0];
  var escrowUtxo = new Transaction.UnspentOutput({
    txid: res.txid,
    vout: res.vout,
    satoshis: res.satoshis,
    scriptPubKey: result.scriptPubKey
  });
  // Make Transaction from escrow UTXO
  var sighash = Signature.SIGHASH_ALL | Signature.SIGHASH_FORKID;
  var spendEscrowTx = new Transaction().from(escrowUtxo).to(buyerAddress, 9350);
  // Sign message with oracle private key
  var oracleSig = Signature.signCDS(message, oraclePriv);
  // Sign transaction with spender private key
  var hex = spendEscrowTx.signEscrow(
    0,
    spenderPriv,
    message,
    oracleSig,
    outScript.toScript(),
    sighash
  );
  var txid = await bitbox.RawTransactions.sendRawTransaction(hex.toString());
  return console.log(txid);
}
```

## License

Code released under [the MIT license](https://github.com/jeton-tech/jeton-lib/blob/master/LICENSE).
