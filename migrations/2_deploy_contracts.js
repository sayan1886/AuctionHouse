var SampleName = artifacts.require('./SampleName.sol');
var AuctionHouse = artifacts.require('./AuctionHouse.sol');
var Auction = artifacts.require('./contracts/Auction.sol');


module.exports = function(deployer) {
    return deployer.deploy(SampleName)
        .then(() => deployer.link(SampleName, AuctionHouse))
        .then(() => deployer.deploy(AuctionHouse));
    // .then(() => deployer.deploy(Auction));
};