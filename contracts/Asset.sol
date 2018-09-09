pragma solidity ^0.4.16;

// Abstract contract for a not yet agreed upon standard for non-fungible
// on chain goods

contract Asset {
    function owner(string _recordId) public view returns (address sellerAddress);

    function setOwner(string _recordId, address _newOwner) public payable returns (bool success);    
}
