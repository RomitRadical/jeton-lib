const bitcore = require("bitcore-lib-cash");
const Address = bitcore.Address;
const Hash = bitcore.crypto.Hash;
const Script = bitcore.Script;
const PublicKey = bitcore.PublicKey;

/**
 * Instantiate an object to create escrow scriptPubKey
 *
 * @param {object} data - The encoded data in various formats
 * @param {PublicKey} data.oraclePubKey - public key of the oracle
 * @param {object[]} data.conditions - array of condition objects
 * @param {string} data.conditions[].message - message for this condition
 * @param {PublicKey} data.conditions[].spenderPubKey - public key of the spender
 * @param {Address} data.conditions[].spenderAddress - (optional instead of pubKey) P2PKH address of the spender
 *
 * @constructor
 */
var OutputScript = function(data) {
  this.conditions = data.conditions;
};

/**
 * @returns {Script}
 */
OutputScript.prototype.toScript = function() {
  //Output Script
  let outScript = Script();

  // Build the conditionals for the parties
  for (let i = 0; i < this.conditions.length; i++) {
    outScript.add(this.buildPartyConditional(i));
    if (i < this.conditions.length - 1) {
      outScript.add("OP_ELSE");
    }
  }
  // End the conditionals
  for (let i = 0; i < this.conditions.length; i++) {
    outScript.add("OP_ENDIF");
  }

  outScript.add("OP_EQUALVERIFY").add("OP_CHECKSIG");

  return outScript;
};

/**
 * @returns {Buffer}
 */
OutputScript.prototype.toBuffer = function() {
  let outScript = this.toScript();
  return outScript.toBuffer();
};

/**
 * Return P2SH version of script
 *
 * @returns {Script}
 */
OutputScript.prototype.toScriptHash = function() {
  let outputBuf = this.toBuffer();
  var outputP2SH = new Script()
    .add("OP_HASH160")
    .add(Hash.sha256ripemd160(outputBuf))
    .add("OP_EQUAL");

  return outputP2SH;
};

/**
 * Return P2SH address
 * @param {Network|string=} network - a {@link Network} object, or a string with the network name ('livenet' or 'testnet')
 *
 * @returns {Address}
 */
OutputScript.prototype.toAddress = function(network) {
  network = network || "livenet";
  let address = new Address(this.toScriptHash(), network, "scripthash");
  return address;
};

/**
 * @returns {Script}
 */
OutputScript.prototype.buildPartyConditional = function(index) {
  let condition = this.conditions[index];
  let s = Script()
    .add("OP_DUP")
    .add(Buffer.from(condition.message, "utf-8"))
    .add("OP_EQUAL")
    .add("OP_IF")
    .add("OP_DROP")
    .add(Buffer.from(condition.message, "utf-8"))
    .add(condition.oraclePubKey.toBuffer())
    .add("OP_CHECKDATASIGVERIFY")
    .add("OP_DUP")
    .add("OP_HASH160")
    .add(condition.spenderAddress.hashBuffer);

  return s;
};

module.exports = OutputScript;
