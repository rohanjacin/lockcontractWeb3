var auction = artifacts.require("Auction");
var ownerverifier = artifacts.require("Groth16Verifier");
var guestverifier = artifacts.require("GuestVerifier");
var lockcontract = artifacts.require("LockZKP");

module.exports = async function(deployer) {
  // deployment steps
  await deployer.deploy(auction);
  await deployer.deploy(ownerverifier);
  await deployer.deploy(guestverifier);

  //console.log("auction:" + auction.address)
  //console.log("ownerverifier:" + ownerverifier.address)
  //console.log("guestverifier:" + guestverifier.address)

  await deployer.deploy(lockcontract, "SampleLock", auction.address, 
            ownerverifier.address, guestverifier.address);
};
