const jeton = require("./jeton-lib");
var BITBOX = require("bitbox-sdk").BITBOX;
var bitbox = new BITBOX({ restURL: `https://rest.bitcoin.com/v2/` });

const PrivateKey = jeton.PrivateKey;
const Signature = jeton.Signature;
const OutputScript = jeton.escrow.OutputScript;
const Transaction = jeton.Transaction;

// Create keypairs for 2 traders and an oracle
// return console.log(PrivateKey());

// Seller keypairs
var sellerPrivKey = new PrivateKey(
  "220d0af479da6c89f75846209149679c6f56d7eb7f5179c1ecf4fbdf15572e38"
);
var sellerPubKey = sellerPrivKey.toPublicKey();
var sellerAddress = sellerPubKey.toAddress();
// console.log("Seller Private Key: " + sellerPrivKey);
// console.log("Seller Public Key: " + sellerPubKey);
//console.log("Seller Address: " + sellerAddress);

//Buyer keypairs
var buyerPrivKey = new PrivateKey(
  "aa1c53d47dec47bb8f3d2ea64c06da68e5688c864e5c7a94323cc1eb32eb868f"
);
var buyerPubKey = buyerPrivKey.toPublicKey();
var buyerAddress = buyerPubKey.toAddress();
// console.log("Buyer Private Key: " + buyerPrivKey);
// console.log("Buyer Public Key: " + buyerPubKey);
// console.log("Buyer Address: " + buyerAddress);

//Oracle keypairs
var oraclePrivKey = new PrivateKey(
  "a3eeaaf3e456fb5357d672ff7acd178a57a2b1e9c9c5031a0100594ec2d4f768"
);
var oraclePubKey = oraclePrivKey.toPublicKey();
var oracleAddress = oraclePubKey.toAddress();
// console.log("Oracle Private Key: " + oraclePrivKey);
// console.log("Oracle Public Key: " + oraclePubKey);
// console.log("Oracle Address: " + oracleAddress);

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

var outScript = new OutputScript(outputScriptData);
// p2sh escrow address to be funded
var escrowAddress = outScript.toAddress();

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
  return console.log(txid);
}

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
