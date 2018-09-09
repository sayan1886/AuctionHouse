module.exports = {
    rpc: {
        host: "localhost",
        port: 8545
    },
    networks: {
        development: {
            host: 'localhost',
            port: 8545,
            network_id: 11,
        }
    },
    solc: {
        optimizer: {
            enabled: true,
            runs: 200
        }
    },
    mocha: {
        useColors: true
    }
};