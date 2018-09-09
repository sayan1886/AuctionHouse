pragma solidity ^0.4.16;

// Sample implementation of a non fungible asset, which is a name resolved to
// an ethereum wallet address

import "./Asset.sol";

contract SampleName is Asset {
    struct Record {
        address owner;
        string name;
        address walletAddress;
    }

    mapping(string => Record) records;  // Map an ID to the record

    modifier onlyOwner(string _recordId) {
        require (records[_recordId].owner == msg.sender);
        _;
    }

    function owner(string _recordId) public view returns (address ownerAddress) {
        return records[_recordId].owner;
    }

    function setOwner(string _recordId, address _newOwner) onlyOwner(_recordId) public payable returns (bool success) {
        records[_recordId].owner = _newOwner;
        return true;
    }

    function addRecord(string _recordId, address _owner, string _name, address _walletAddress) public payable returns (bool sufficient) {
        if (records[_recordId].owner != 0) {
            // If a record with this name already exists
            return false;
        }

        records[_recordId].owner = _owner;
        records[_recordId].name = _name;
        records[_recordId].walletAddress = _walletAddress;
        return true;
    }

    function getWalletAddress(string _recordId) public view returns (address walletAddress) {
        return records[_recordId].walletAddress;
    }

    // Allow the owner to update the wallet address of the record
    function updateRecordWalletAddress(string _recordId, address _newWalletAddress) onlyOwner(_recordId) public payable returns (bool success) {
        if (records[_recordId].owner == 0) {
            // We don't know this record
            return false;
        }

        records[_recordId].walletAddress = _newWalletAddress;
        return true;	
    }
}
