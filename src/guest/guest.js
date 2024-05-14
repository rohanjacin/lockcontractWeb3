const { HandshakeIntf } = require("./interface/handshake_intf.js");
//const { Web3 } = require('web3');
var hsm = require('./interface/hsm.js');
const BN = require("bn.js");
const { GuestProver } = require("./prover.js");
var elliptic = require('elliptic');
var EC = elliptic.ec;

const ganacheUrl = 'ws://localhost:8545';

class LockNetwork extends HandshakeIntf {
	constructor(_privKey) {
		super();
		this.Lock = null;
		this.samplelock = null;
		this.guest = null;
    this.owner = null;
    this.guestprover = new GuestProver();
		this.buildContractEventHandler();

		console.log("Lock net init.");
  	
  	const ec = new EC('secp256k1');

    // Generates a wallet from the signers private key
    // and signs the given message hash 
    this.signMsgViaSecret = function (_msg) {

      // Create a wallet to sign the hash with
      //let wallet = new hre.ethers.Wallet(_privKey);

      //console.log("wallet.address:" + wallet.address);
      console.log("In signMsgViaSecret:" + _msg);

      let key = ec.genKeyPair();
      let privkey = key.getPrivate();
      let pubkey = key.getPublic();

      let signature = ec.sign(_msg, privkey);
      //let pubkey = ec.keyFromSecret(secret);

      console.log("privkey:" + privkey);
      console.log("pubkey(x):" + pubkey.x);
      console.log("pubkey(y):" + pubkey.y);
      console.log("signature(r):" + signature.r);
      console.log("signature(s):" + signature.s);

      return {r: signature.r, s: signature.s, pubkey: pubkey};
    }		
	}
}

// Connects to the Lock contract
LockNetwork.prototype.connect = async function () {

	let Lock = artifacts.require("LockZKP");
	let samplelock1 = await Lock.at('0x6817d4721001E998eD30915d8C6d36c764BB058c');
	web3.setProvider(ganacheUrl);
	this.web3 = web3;

	let accounts = await web3.eth.getAccounts();
	this.samplelock = new web3.eth.Contract(samplelock1.abi, samplelock1.address);
	console.log("this.samplelock" + Object.keys(this.samplelock));
	console.log("currentProvider" + web3.currentProvider.url);

	this.guest = accounts[2];
	//console.log("LockContract:" + this.samplelock.GuestApproved);

	//const events = await this.samplelock.getPastEvents('GuestApproved');
	//console.log("Evwnt:s:" + JSON.stringify(events));
	console.log("accounts[2]:" + JSON.stringify(accounts[2]));

	await this.registerEvents();
	await
	this.requestRoom();	
}

LockNetwork.prototype.registerEvents = async function () {

	await this.samplelock.events.GuestApproved()
	.on('data', event => {
		let data = event.returnValues;
		console.log("We have been approved by owner..");
		console.log("Guest:" + data.guest);
		console.log("Owner:" + data.owner);
		console.log("Ctx:" + data.ctx);

		let nonce0 = data.ctx.nonce0;
		nonce0 = nonce0.split("0x");
		console.log("nonce0:" + nonce0);
	
    let _nonce0 = new BN(nonce0[1], 16).toBuffer(65);

    //_nonce0 = new Buffer.from(nonce0[1], 'hex');
	  this.owner = data.owner;
	  this.sendRequest(_nonce0);
	})

  await this.samplelock.events.RespondAuth()
  .on('data', event => {
    let data = event.returnValues;

    console.log("Response received from owner..");
    console.log("Guest:" + data.guest);
    console.log("Owner:" + data.owner);
    console.log("Ctx:" + data.ctx);

    let nonce = data.ctx.ownernonce;

    let nonce0 = nonce[0].split("0x");
    let nonce1 = nonce[1].split("0x");
    let seed = nonce[2].split("0x");
    let counter = nonce[3].split("0x");
    let hmac = nonce[4].split("0x");

    nonce0 = new BN(nonce0[1], 16).toBuffer(65);
    nonce1 = new BN(nonce1[1], 16).toBuffer(32);
    seed = new BN(seed[1], 16).toBuffer(65);
    counter = new BN(counter[1], 16).toBuffer(1);
    hmac = new BN(hmac[1], 16).toBuffer(32);

    let respnonce = Buffer.concat([nonce0, nonce1, seed, counter, hmac],
                 nonce0.length + nonce1.length + seed.length +
                 counter.length + hmac.length);
    console.log("Nonce is:" + JSON.stringify(respnonce));
    console.log("Nonce(len):" + respnonce.length);

    this.sendChallenge(respnonce);
  });
}

// Registers for event from the lock handshake interface which
// communicates with the Lock handshake protocol
LockNetwork.prototype.buildContractEventHandler = async function () {
	this.on('contract_event', function (event, data) {

		if (event == 'challenge') {
			console.log("Solving the challenge");
			this.reqAuth(data);
		}
		else if (event == 'response') {
			console.log("Creating the challenge (response)");
		}				
	}.bind(this));
}

LockNetwork.prototype.requestRoom = async function () {
	let bidPrice = 110; // bid price for room
	
	await this.samplelock.methods.registerGuest().send({from: this.guest, value: bidPrice, gas: 1000000});
/*	.on('receipt', receipt => {
		//console.log("Receipt:" + JSON.stringify(receipt));
	});
*/
	console.log("We requested room as guest");
}

LockNetwork.prototype.reqAuth = async function (nonce) {
	
	let nonce0 = Uint8Array.from(nonce.data.slice(0, 65));
	let nonce1 = Uint8Array.from(nonce.data.slice(65, 97));
	let seed = Uint8Array.from(nonce.data.slice(97, 162));
	let counter = Uint8Array.from(nonce.data.slice(162, 163));
	let hmac = Uint8Array.from(nonce.data.slice(163, 195));

	const challenge = {nonce0, nonce1, seed, counter, hmac};

  // Off chain off channel secret
  //const secret = prompt('Enter secret');

  // Calculate signature of the message 'guest'
/*  let msghash = this.web3.utils.sha3("guest");
  console.log("msghash:" + msghash);  

  const sign = this.signMsgViaSecret(msghash);
  console.log("Sign:" + JSON.stringify(sign));

  // Generate proof
  let { proof, publicSignals } = await this.guestprover.prove(
                            sign.r, sign.s, sign.pubkey, msghash); 
*/
  console.log("Sending reqAuth: " + JSON.stringify(challenge));
	await this.samplelock.methods.reqAuth(challenge, /*proof[0],
						proof[1], proof[2], publicSignals*/).send(
						{from: this.guest, gas: 1000000});
}

var locknet = new LockNetwork();

locknet.connect().catch((error) => {
	console.error(error);
	process.exitCode = 1;	
});

locknet.on('state_event', (event) => {

  state = machine.transition(state, event);
});

const machine = hsm.createMachine({
  initialState: 'idle',

  idle: {

    actions: {

      onEnter() {

        //console.log('idle: onEnter')
      },

      onExit() {

        //console.log('idle: onExit')

      },

    },

    transitions: {

      request: {

        target: 'waiting',

        action() {

          console.log('transition action for "request" in "idle" state');


        },

      },

    },

  },

  waiting: {

    actions: {

      onEnter() {

        locknet.waitChallenge();
      },

      onExit() {

        //console.log('waiting: onExit')

      },

    },

    transitions: {

      challenge: {

        target: 'response',

        action() {

          console.log('transition action for "challenge" in "waiting" state')
          locknet.solveChallenge();
        },

      },

    },

  },


  response: {

    actions: {

      onEnter() {

        console.log('challenge: onEnter')
        
      },

      onExit() {

        console.log('challenge: onExit')

      },

    },

    transitions: {

      validated: {

        target: 'response',

        action() {
          locknet.createChallenge();
        }
      },

      send: {

        target: 'ack_pending',

        action() {

          console.log('transition action for "send" in "challenge" state')
          //locknet.sendChallenge();
        },

      },

    },

  },

  ack_pending: {

    actions: {

      onEnter() {

        console.log('ack_pending: onEnter')

      },

      onExit() {

        console.log('ack_pending: onExit')

      },

    },

    transitions: {

      response: {

        target: 'ack',

        action() {

          console.log('transition action for "response" in "response_pending" state')

        },

      },

    },

  },

  ack: {

    actions: {

      onEnter() {

        //console.log('ack: onEnter')

      },

      onExit() {

        //console.log('ack: onExit')

      },

    },

    transitions: {

      done: {

        target: 'idle',

        action() {

          console.log('transition action for "done" in "ack" state')

        },

      },

    },

  }
})

let state = machine.value

module.exports = function (callback){

	//callback();
}