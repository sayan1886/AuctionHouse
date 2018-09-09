var AuctionHouse = artifacts.require('./AuctionHouse.sol');

var log = console.log;
var balance = web3.eth.getBalance;

contract("AuctionHouse", function(accounts) {
    it("should know if a seller owns an asset on an external contract", function() {
        var sn = SampleName.deployed();
        var owner = accounts[0];
        var recordId = "test.name";

        // Create a samplename record
        sn.addRecord(recordId, owner, recordId, owner, { from: owner }, function(err, res) {
            return AuctionHouse.new(function(err, ah) {
                return ah.partyOwnsAsset(owner, sn.address, recordId, { from: account }, function(err, res) {
                    assert.strictEqual(res, true, "the owner doesn't own this asset");
                }, function(err, res) {
                    return ah.partyOwnsAsset(accounts[1], sn.address, recordId, { from: account }, function(res) {
                        assert.strictEqual(res, false, "the owner owns this asset, but shouldn't.");
                    });
                });
            });
        });
    });
});